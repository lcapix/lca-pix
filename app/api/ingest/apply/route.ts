/**
 * POST /api/ingest/apply — reviewed ingestion plan → real case, atomically.
 *
 * Body: { project_id, case_name, nodes, flows, costs, notes } — the plan a
 * user confirmed (and possibly edited: substituted matches, deselected
 * flows) on the review screen. Creates the case, the component tree exactly as
 * extracted, however deep (parent names remapped to new ids in order;
 * hierarchy_level = depth from the product), the flows, and the aggregated
 * cost columns in ONE transaction — the whole case exists or none of it.
 *
 * Flows with no substance_id are counted as held-for-review, never silently
 * dropped; flows whose unit cannot convert into the substance's factor unit
 * are skipped and reported the same way (mirrors the save-time unit guard).
 */
import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { COLUMN_LIMITS, decimalMax, fitToColumn, isOutOfRangeError } from '@/lib/field-limits';
import { z } from 'zod';
import { query, queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError, projectAccessDenied, reachableCasesFilter } from '@/lib/route-guard';
import { convertQuantity } from '@/lib/units';
import { findUsableSubstance, SUBSTANCE_ERROR } from '@/lib/flow-fields';
import type { IngestCost, IngestNode } from '@/lib/ingest/schema';
import type { MappedFlow } from '@/lib/ingest/maplca';
import { nodeDepths, validateProcessModel } from '@/lib/ingest/schema';

import { costColumn } from '@/lib/ingest/cost-columns';
import { recordHeldLines, type HeldLine } from '@/lib/import/held-lines';

// ── Body validation ──────────────────────────────────────────────────────────
// Every value that reaches SQL is checked for type here. mysql2's .query()
// escapes client-side and expands an object into `col` = val fragments, so an
// object where a number belongs must never get that far (L6). Enums use exact
// strings, so prototype keys ("constructor", "__proto__") are refused (L7).
// Extra fields from the review screen (candidates, match_score...) pass through.

const id = z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]);
const optionalId = z.union([id, z.null(), z.literal('')]).optional().transform((v) => (v ? v : null));
const text = (max: number) => z.string().max(max);
// Strings stored in a column are capped at the column's size (lib/field-limits.ts):
// a longer one is a 400 naming the field, never a failure inside the transaction.
const K = COLUMN_LIMITS.component;
// Numbers likewise: a node quantity is DECIMAL(15,6), a cost DECIMAL(15,2),
// labour hours DECIMAL(10,4). (Several lines summed onto one step can still
// overflow; the transaction rolls back and the route answers 400.)
const bounded = (max: number) => z.number().finite().min(-max).max(max);
const QTY_MAX = decimalMax(K.quantity);
const COST_MAX = decimalMax(K.labor_cost);
const HOURS_MAX = decimalMax(K.labor_hours);
const provenance = z
  .object({ doc: z.string().max(1000), locator: z.string().max(1000).optional(), snippet: z.string().max(5000).optional() })
  .passthrough();

const nodeSchema = z
  .object({
    name: text(K.component_name.max).min(1),
    tier: z.enum(['product', 'machine_line', 'subprocess', 'operation', 'elemental_task']),
    parent: text(K.component_name.max).nullable(),
    description: z.string().max(5000).nullable().optional(),
    quantity: bounded(QTY_MAX).nullable().optional(),
    unit: text(K.unit.max).nullable().optional(),
    provenance: provenance.optional(),
  })
  .passthrough();

const flowSchema = z
  .object({
    node: text(255).optional().default(''),
    substance_text: text(500),
    substance_id: z.number().int().positive().nullable().optional(),
    direction: z.enum(['input', 'output']),
    quantity: z.number().finite(),
    unit: text(COLUMN_LIMITS.flows.unit.max),
    provenance: z.string().max(1000).nullable().optional(),
    attach_component_id: optionalId,
  })
  .passthrough();

const costSchema = z
  .object({
    node: text(255).optional().default(''),
    category: z.enum(['labor', 'energy', 'material', 'transportation', 'opex', 'capex']),
    amount: bounded(COST_MAX).nullable(),
    hours: bounded(HOURS_MAX).nullable().optional(),
    occupation: text(K.labor_occupation.max).nullable().optional(),
    provenance: provenance.nullable().optional(),
    attach_component_id: optionalId,
  })
  .passthrough();

const bodySchema = z.object({
  project_id: optionalId,
  case_name: z.string().max(COLUMN_LIMITS.case_table.case_name.max).optional().default(''),
  nodes: z.array(nodeSchema).max(5000).optional().default([]),
  flows: z.array(flowSchema).max(20000).optional().default([]),
  costs: z.array(costSchema).max(20000).optional().default([]),
  notes: z.array(z.string().max(5000)).max(1000).optional().default([]),
  target_case_id: optionalId,
  attach_component_id: optionalId,
  // Append mode: the reviewer's decision for each step the document describes,
  // keyed by step name. Must be declared here: bodySchema is strict, so an
  // undeclared key is stripped and every step would silently default to skip.
  node_actions: z
    .record(
      text(K.component_name.max),
      z.object({
        action: z.enum(['attach', 'create', 'skip']).optional(),
        component_id: optionalId,
      }),
    )
    .refine((r) => Object.keys(r).length <= 5000, { message: 'At most 5000 step decisions' })
    .optional()
    .default({}),
  // Append mode: for a step that already has a cost in a column this document
  // writes, keyed "<component_id>|<column>": keep what is there, replace it,
  // or add to it. Without a decision the line adds (the API's old behaviour);
  // the review screen always sends one, defaulting to keep, so a re-imported
  // document never doubles a cost unseen.
  cost_modes: z
    .record(z.string().regex(/^\d+\|[a-z_]+$/), z.enum(['keep', 'replace', 'add']))
    .refine((r) => Object.keys(r).length <= 5000, { message: 'At most 5000 cost decisions' })
    .optional()
    .default({}),
  // The same for flows: a step that already has a flow of a substance in one
  // direction, keyed "<component_id>|<substance_id>|<input|output>". Replace
  // removes that step's existing flows of the substance in that direction
  // before the document's go in.
  flow_modes: z
    .record(z.string().regex(/^\d+\|\d+\|(input|output)$/), z.enum(['keep', 'replace', 'add']))
    .refine((r) => Object.keys(r).length <= 5000, { message: 'At most 5000 flow decisions' })
    .optional()
    .default({}),
});

/**
 * The factor unit of every substance the plan's flows name, provided the caller
 * may use each one: a library substance or a custom one they created (security
 * audit L3, the ingest twin of FLOW-5). Another user's private substance, or an
 * id that does not exist, refuses the whole plan with 400 before anything is
 * written, and the substance's name is never echoed.
 */
async function usableSubstanceUnits(
  flows: Array<{ substance_id?: number | null }>,
  userId: number,
): Promise<{ ok: true; units: Map<number, string | null> } | { ok: false; response: NextResponse }> {
  const units = new Map<number, string | null>();
  for (const [i, f] of flows.entries()) {
    const sid = f.substance_id;
    if (!sid || units.has(sid)) continue;
    const row = await findUsableSubstance(sid, userId);
    if (!row) {
      return {
        ok: false,
        response: NextResponse.json({ error: `Flow ${i + 1}: ${SUBSTANCE_ERROR}` }, { status: 400 }),
      };
    }
    units.set(sid, row.default_unit ?? null);
  }
  return { ok: true, units };
}

function invalid(error: z.ZodError) {
  const issue = error.issues[0];
  const where = issue?.path?.length ? issue.path.join('.') : 'body';
  return NextResponse.json({ error: `Invalid plan: ${where}: ${issue?.message ?? 'invalid'}` }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const json = await readJson(request);
    if (!json.ok) return json.response;
    const parsed = bodySchema.safeParse(json.body);
    if (!parsed.success) return invalid(parsed.error);
    const body = parsed.data;

    const projectId = body.project_id ?? 0;
    const caseName: string = body.case_name.trim();
    const nodes = body.nodes as unknown as IngestNode[];
    const flows = body.flows as unknown as MappedFlow[];
    const costs = body.costs as unknown as IngestCost[];
    const notes: string[] = body.notes;

    const targetCaseId = body.target_case_id;
    // Append mode: what the reviewer decided to do with each step the document
    // describes — attach it to an existing step, create it, or skip it. Without
    // this the hierarchy was dropped entirely, so re-importing a routing onto a
    // live case added nothing (and creating blindly would have doubled it).
    const nodeActions = body.node_actions;
    const costModes = body.cost_modes;
    const flowModes = body.flow_modes;
    const attachComponentId = body.attach_component_id;

    // ── Append mode ──────────────────────────────────────────────────────────
    // Attach an ingested plan's flows and costs onto an EXISTING node in an
    // existing case, instead of spawning a new case. This is what lets ONE
    // comprehensive case be assembled from several documents (a routing gives the
    // skeleton, then a BOM adds materials, then a utility bill adds energy…). The
    // user picks the attach node on the review screen, so nothing is auto-placed.
    if (targetCaseId) {
      const caseRow = await queryOne<any>(
        `SELECT project_id FROM case_table WHERE case_id = ?`,
        [targetCaseId]
      );
      if (!caseRow) {
        return NextResponse.json({ error: 'Target case not found' }, { status: 404 });
      }
      const denied = await caseAccessDenied(userId, targetCaseId, 'editor', { notFound: 'Target case not found' });
      if (denied) return denied;
      // Each line goes to its own step (chosen at review); every step must be
      // part of this case. The body's attach_component_id is the default for
      // lines without one; a line with neither is held, never guessed.
      const caseComponents = await query<any>(
        `SELECT component_id, component_name, hierarchy_level FROM component WHERE case_id = ?`,
        [targetCaseId]
      );
      const nameById = new Map<number, string>(
        (caseComponents as any[]).map((c) => [Number(c.component_id), String(c.component_name)])
      );
      if (attachComponentId && !nameById.has(attachComponentId)) {
        return NextResponse.json(
          { error: 'The chosen default step is not part of the target case' },
          { status: 400 }
        );
      }
      const stepFor = (item: { attach_component_id?: number | null }): number | null => {
        const id = Number(item?.attach_component_id);
        if (id && nameById.has(id)) return id;
        return attachComponentId && nameById.has(attachComponentId) ? attachComponentId : null;
      };

      // Factor-unit lookup for the unit guard (same discipline as create mode),
      // over substances the caller may use only (L3).
      const usable = await usableSubstanceUnits(flows, userId);
      if (!usable.ok) return usable.response;
      const unitBySubstance = usable.units;

      const skippedFlows: string[] = [];
      // The same lines, kept for later (migrate-040, E12 "lines held").
      const heldLines: HeldLine[] = [];
      const heldFlow = (f: any, reason: HeldLine['reason']) =>
        heldLines.push({
          kind: 'flow', reason, step_name: f.node || null, substance_text: f.substance_text, substance_id: f.substance_id ?? null,
          direction: f.direction, quantity: f.quantity, unit: f.unit, provenance: f.provenance ?? null,
        });
      const appendResult = await transaction(async (conn) => {
        let applied = 0;
        let held = 0;
        let flowsKept = 0;
        let flowsReplaced = 0;
        const usedSteps = new Set<number>();
        // Replace clears a step's existing flows of a substance once, before
        // the first of the document's lines for it goes in.
        const cleared = new Set<string>();

        // Step 0: settle the steps themselves. idByName starts from what the
        // case already has, so a flow naming a step the document shares with
        // the case resolves without the reviewer picking anything.
        const idByName = new Map<string, number>();
        const levelById = new Map<number, number>();
        for (const c of caseComponents as any[]) {
          idByName.set(String(c.component_name).trim().toLowerCase(), Number(c.component_id));
          levelById.set(Number(c.component_id), Number(c.hierarchy_level) || 1);
        }
        let stepsCreated = 0;
        let stepsAttached = 0;

        // Plan order, so a parent is created before the child that names it.
        for (const n of nodes) {
          const decision = nodeActions[n.name] ?? {};
          const action = decision.action ?? 'skip';
          if (action === 'attach' && decision.component_id && nameById.has(decision.component_id)) {
            idByName.set(n.name.trim().toLowerCase(), decision.component_id);
            stepsAttached++;
            continue;
          }
          if (action !== 'create') continue;

          const parentId = n.parent ? idByName.get(n.parent.trim().toLowerCase()) ?? null : null;
          // Depth is the parent's depth plus one. Hard-coding it put every new
          // step at level 2 regardless of where it actually sat.
          const anchor = parentId ?? attachComponentId ?? null;
          const level = anchor ? (levelById.get(anchor) ?? 1) + 1 : 1;
          const [res] = await conn.query<any>(
            `INSERT INTO component
               (case_id, parent_component_id, component_name, component_type, hierarchy_level,
                quantity, unit, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              targetCaseId,
              parentId ?? attachComponentId ?? null,
              n.name,
              n.tier,
              Math.max(1, level),
              n.quantity ?? 1,
              n.unit ?? 'unit',
              n.description ?? null,
            ]
          );
          const newId = Number(res.insertId);
          idByName.set(n.name.trim().toLowerCase(), newId);
          levelById.set(newId, Math.max(1, level));
          nameById.set(newId, n.name);
          stepsCreated++;
        }

        // Where a line goes, in order: the step the reviewer set for it in the
        // STEP column; else the step it names in the document (attached or
        // just created above); else the default step; else it is held. The
        // name used to come first, so a line went to a same-named step even
        // when the reviewer had picked another one.
        const stepForLine = (item: { node?: string; attach_component_id?: number | null }): number | null => {
          const own = Number(item?.attach_component_id);
          if (own && nameById.has(own)) return own;
          const named = item.node ? idByName.get(item.node.trim().toLowerCase()) : undefined;
          return named ?? stepFor({});
        };

        for (const f of flows) {
          if (!f.substance_id) {
            held++;
            skippedFlows.push(`${f.substance_text}: no confirmed substance match`);
            heldFlow(f, 'no_substance');
            continue;
          }
          const target = stepForLine(f as any);
          if (!target) {
            held++;
            skippedFlows.push(`${f.substance_text}: no step chosen`);
            heldFlow(f, 'no_step');
            continue;
          }
          // lib/units decides, as the engine will ('Mg' is not 'mg').
          const factorUnit = unitBySubstance.get(f.substance_id);
          if (factorUnit && !convertQuantity(1, f.unit, factorUnit)) {
            held++;
            skippedFlows.push(
              `${f.substance_text}: unit '${f.unit}' cannot convert to factor unit '${factorUnit}'`
            );
            heldFlow(f, 'unit');
            continue;
          }
          const flowKey = `${target}|${f.substance_id}|${f.direction}`;
          const flowMode = flowModes[flowKey] ?? 'add';
          if (flowMode === 'keep') {
            flowsKept++;
            continue;
          }
          if (flowMode === 'replace' && !cleared.has(flowKey)) {
            cleared.add(flowKey);
            const [del]: any = await conn.query(
              `DELETE FROM flows WHERE component_id = ? AND substance_id = ? AND flow_type = ?`,
              [target, f.substance_id, f.direction]
            );
            flowsReplaced += Number(del?.affectedRows ?? 0);
          }
          await conn.query(
            `INSERT INTO flows
               (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [
              target,
              f.substance_id,
              f.direction,
              f.quantity,
              f.unit,
              f.provenance ? `ingested: ${f.provenance}`.slice(0, 255) : null,
            ]
          );
          applied++;
          usedSteps.add(target);
        }

        // Costs ADD onto each step's existing columns (append, never overwrite).
        const totals = new Map<string, number>(); // "componentId|column" -> amount
        // Labor multiplicands per step (hours, and the occupation that priced
        // them), so a replaced or added labor cost keeps hours × wage true.
        const laborHours = new Map<number, { hours: number; soc?: string }>();
        for (const c of costs) {
          const col = costColumn(c.category);
          const target = stepForLine(c as any);
          if (!col) continue;
          if (!target) {
            skippedFlows.push(`${c.category} cost ${c.amount}: no step chosen`);
            heldLines.push({
              kind: 'cost', reason: 'no_step', step_name: c.node || null, cost_category: c.category,
              amount: c.amount, hours: (c as any).hours ?? null, occupation: (c as any).occupation ?? null,
              provenance: c.provenance?.doc ?? null,
            });
            continue;
          }
          const key = `${target}|${col}`;
          totals.set(key, (totals.get(key) ?? 0) + Number(c.amount || 0));
          usedSteps.add(target);
          if (col === 'labor_cost' && Number((c as any).hours) > 0) {
            const acc = laborHours.get(target) ?? { hours: 0 };
            acc.hours += Number((c as any).hours);
            acc.soc ??= (c as any).occupation ?? undefined;
            laborHours.set(target, acc);
          }
        }
        let costsKept = 0;
        let costsReplaced = 0;
        for (const [key, amount] of totals) {
          const [id, col] = key.split('|');
          const mode = costModes[key] ?? 'add';
          if (mode === 'keep') {
            costsKept++;
            continue;
          }
          if (mode === 'replace') costsReplaced++;
          // col is from costColumn(), a fixed whitelist; never from the body.
          await conn.query(
            mode === 'replace'
              ? `UPDATE component SET ${col} = ? WHERE component_id = ?`
              : `UPDATE component SET ${col} = COALESCE(${col}, 0) + ? WHERE component_id = ?`,
            [amount, Number(id)]
          );
          const lh = col === 'labor_cost' ? laborHours.get(Number(id)) : undefined;
          if (lh) {
            // Hours follow the cost: replaced with it, or added to it. The
            // occupation is the document's on a replace, and fills a blank on
            // an add (a typed 'user' rate or a reference wage already there stays).
            const hours = Math.round(lh.hours * 10000) / 10000;
            try {
              await conn.query(
                mode === 'replace'
                  ? `UPDATE component SET labor_hours = ?, labor_occupation = ? WHERE component_id = ?`
                  : `UPDATE component SET labor_hours = COALESCE(labor_hours, 0) + ?,
                         labor_occupation = COALESCE(labor_occupation, ?) WHERE component_id = ?`,
                [hours, lh.soc ?? null, Number(id)]
              );
            } catch (e: any) {
              if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e; // older schema: the cost still applied
            }
          }
        }

        // The document's name only (a flow's provenance also carries its row).
        const sourceDoc =
          costs[0]?.provenance?.doc || String(flows[0]?.provenance ?? '').split(' · ')[0] || 'a document';
        await conn.query(
          `UPDATE case_table
              SET description = LEFT(COALESCE(description, '') || CAST(? AS text), 2000)
            WHERE case_id = ?`,
          [
            ` Added ${sourceDoc}: ${applied} flow(s) on ${usedSteps.size} step(s)` +
              (stepsCreated ? `, ${stepsCreated} step(s) created` : '') +
              (stepsAttached ? `, ${stepsAttached} matched to existing steps` : '') +
              '.'.slice(0, 900),
            targetCaseId,
          ]
        );

        const heldKept = await recordHeldLines(conn, targetCaseId, userId, heldLines);

        return {
          applied,
          held,
          heldKept,
          costCols: totals.size - costsKept,
          costsKept,
          costsReplaced,
          flowsKept,
          flowsReplaced,
          steps: [...usedSteps],
          stepsCreated,
          stepsAttached,
        };
      });

      return NextResponse.json(
        {
          success: true,
          appended: true,
          case_id: targetCaseId,
          attach_component_id: attachComponentId,
          steps_used: appendResult.steps.map((id) => nameById.get(id)),
          steps_created: appendResult.stepsCreated,
          steps_matched: appendResult.stepsAttached,
          flows_applied: appendResult.applied,
          flows_held_for_review: appendResult.held,
          held_details: skippedFlows,
          held_lines_kept: appendResult.heldKept,
          cost_columns_updated: appendResult.costCols,
          costs_kept: appendResult.costsKept,
          costs_replaced: appendResult.costsReplaced,
          flows_kept: appendResult.flowsKept,
          flows_replaced: appendResult.flowsReplaced,
        },
        { status: 200 }
      );
    }

    if (!projectId || !caseName || nodes.length === 0) {
      return NextResponse.json(
        { error: 'project_id, case_name, and at least one node are required' },
        { status: 400 }
      );
    }

    const denied = await projectAccessDenied(userId, projectId, 'editor', { notFound: 'Project not found' });
    if (denied) return denied;
    // The name is numbered against the cases the caller reaches only (B-A1).
    const onlyReachable = await reachableCasesFilter(userId, projectId, 'case_table');

    // Re-validate structure server-side — the client may have edited the plan.
    const structural = validateProcessModel({
      product_name: caseName,
      case_name: caseName,
      nodes,
      flows: [],
      costs: [],
      source_docs: [],
      notes: [],
    });
    if (structural.length) {
      return NextResponse.json(
        { error: `Plan structure invalid: ${structural.join('; ')}` },
        { status: 400 }
      );
    }

    // Factor-unit lookup for the unit guard, outside the transaction, over
    // substances the caller may use only (L3).
    const usable = await usableSubstanceUnits(flows, userId);
    if (!usable.ok) return usable.response;
    const unitBySubstance = usable.units;

    const skippedFlows: string[] = [];
    const heldLines: HeldLine[] = [];
    const heldFlow = (f: any, reason: HeldLine['reason']) =>
      heldLines.push({
        kind: 'flow', reason, step_name: f.node || null, substance_text: f.substance_text, substance_id: f.substance_id ?? null,
        direction: f.direction, quantity: f.quantity, unit: f.unit, provenance: f.provenance ?? null,
      });

    const result = await transaction(async (conn) => {
      const sourceDoc =
        costs[0]?.provenance?.doc || String(flows[0]?.provenance ?? '').split(' · ')[0] || 'uploaded document';
      // A short, readable description; the import notes were shown at review
      // and each step keeps its own [source: …] provenance.
      // Two cases with the same name cannot be told apart later. The user did
      // not type this name (it comes from the document), so number it instead
      // of failing the import.
      let uniqueName = caseName;
      for (let n = 2; n < 50; n++) {
        const [[taken]]: any = await conn.query(
          `SELECT case_id FROM case_table
            WHERE project_id = ? AND LOWER(TRIM(case_name)) = LOWER(TRIM(?))${onlyReachable.sql} LIMIT 1`,
          [projectId, uniqueName, ...onlyReachable.params]
        );
        if (!taken) break;
        // The number is added here, so the base is cut to leave room for it.
        const suffix = ` (${n})`;
        uniqueName = `${fitToColumn(caseName, { kind: 'chars', max: COLUMN_LIMITS.case_table.case_name.max - suffix.length })}${suffix}`;
      }
      const [caseIns]: any = await conn.query(
        `INSERT INTO case_table (project_id, created_by, case_name, case_type, description)
         VALUES (?, ?, ?, 'base', ?)`,
        [projectId, userId, uniqueName, `Built from ${sourceDoc}.`.slice(0, 1000)]
      );
      const caseId = caseIns.insertId;
      // The case is made where the study says (project region), until changed.
      try {
        await conn.query(
          `UPDATE case_table SET region_code = (SELECT region_code FROM project WHERE project_id = ?)
            WHERE case_id = ?`,
          [projectId, caseId]
        );
      } catch (e: any) {
        if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e; // before migrate-018
      }

      // Components in plan order (parents always precede children — the
      // connector emits them that way and validation guarantees the links).
      const idByName = new Map<string, number>();
      const depths = nodeDepths(nodes);
      for (const n of nodes) {
        const [compIns]: any = await conn.query(
          `INSERT INTO component
             (case_id, parent_component_id, component_name, component_type,
              hierarchy_level, description, quantity, unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            caseId,
            n.parent ? (idByName.get(n.parent) ?? null) : null,
            n.name,
            n.tier,
            depths.get(n.name) ?? 1,
            `${n.description ?? ''}${
              n.provenance ? ` [source: ${n.provenance.doc} · ${n.provenance.locator}]` : ''
            }`.trim() || null,
            n.quantity ?? 1.0,
            n.unit ?? 'unit',
          ]
        );
        idByName.set(n.name, compIns.insertId);
      }

      // Labor multiplicands on each step: hours per unit and the occupation
      // (BLS SOC) whose wage priced them, so the step shows hours × wage and
      // an equipment list can reuse the hours for machine energy.
      const laborByNode = new Map<string, { hours: number; soc?: string }>();
      for (const c of costs) {
        if (c.category !== 'labor' || !(Number(c.hours) > 0) || !idByName.has(c.node)) continue;
        const acc = laborByNode.get(c.node) ?? { hours: 0 };
        acc.hours += Number(c.hours);
        acc.soc ??= c.occupation;
        laborByNode.set(c.node, acc);
      }
      for (const [node, v] of laborByNode) {
        try {
          await conn.query(
            `UPDATE component SET labor_hours = ?, labor_occupation = ? WHERE component_id = ?`,
            [Math.round(v.hours * 10000) / 10000, v.soc ?? null, idByName.get(node)]
          );
        } catch (e: any) {
          if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e; // older schema: cost still applied
        }
      }

      // The product's quantity is the data basis (how many units the document
      // describes: 1 for a per-unit routing, a year's output for ITAC).
      const rootQty = Number(nodes.find((n) => n.parent === null)?.quantity);
      if (rootQty > 0 && rootQty !== 1) {
        try {
          await conn.query(`UPDATE case_table SET modeled_output = ? WHERE case_id = ?`, [rootQty, caseId]);
        } catch (e: any) {
          if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e; // no migrate-014
        }
      }

      let applied = 0;
      let held = 0;
      for (const f of flows) {
        if (!f.substance_id) {
          held++;
          skippedFlows.push(`${f.substance_text} (${f.node}): no confirmed substance match`);
          heldFlow(f, 'no_substance');
          continue;
        }
        const componentId = idByName.get(f.node);
        if (!componentId) {
          held++;
          skippedFlows.push(`${f.substance_text} (${f.node}): node not in plan`);
          heldFlow(f, 'no_step');
          continue;
        }
        // lib/units decides, as the engine will ('Mg' is not 'mg').
        const factorUnit = unitBySubstance.get(f.substance_id);
        if (factorUnit && !convertQuantity(1, f.unit, factorUnit)) {
          held++;
          skippedFlows.push(
            `${f.substance_text} (${f.node}): unit '${f.unit}' cannot convert to factor unit '${factorUnit}'`
          );
          heldFlow(f, 'unit');
          continue;
        }
        await conn.query(
          `INSERT INTO flows
             (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [
            componentId,
            f.substance_id,
            f.direction,
            f.quantity,
            f.unit,
            f.provenance ? `ingested: ${f.provenance}`.slice(0, 255) : null,
          ]
        );
        applied++;
      }

      // Aggregate costs per node into the component cost columns.
      const costByNode = new Map<string, Record<string, number>>();
      for (const c of costs) {
        const col = costColumn(c.category);
        const componentId = idByName.get(c.node);
        if (!col) continue;
        // A cost on a step the plan does not have was dropped without a word;
        // it is held like a flow now.
        if (!componentId) {
          skippedFlows.push(`${c.category} cost ${c.amount} (${c.node}): node not in plan`);
          heldLines.push({
            kind: 'cost', reason: 'no_step', step_name: c.node || null, cost_category: c.category,
            amount: c.amount, hours: (c as any).hours ?? null, occupation: (c as any).occupation ?? null,
            provenance: c.provenance?.doc ?? null,
          });
          continue;
        }
        const acc = costByNode.get(c.node) ?? {};
        acc[col] = (acc[col] ?? 0) + Number(c.amount || 0);
        costByNode.set(c.node, acc);
      }
      for (const [node, cols] of costByNode) {
        const componentId = idByName.get(node)!;
        const sets = Object.keys(cols).map((k) => `${k} = ?`).join(', ');
        await conn.query(`UPDATE component SET ${sets} WHERE component_id = ?`, [
          ...Object.values(cols),
          componentId,
        ]);
      }

      const heldKept = await recordHeldLines(conn, caseId, userId, heldLines);

      return { caseId, caseName: uniqueName, components: idByName.size, applied, held, heldKept, costNodes: costByNode.size };
    });

    return NextResponse.json(
      {
        success: true,
        case_id: result.caseId,
        case_name: result.caseName,
        components_created: result.components,
        flows_applied: result.applied,
        flows_held_for_review: result.held,
        held_details: skippedFlows,
        held_lines_kept: result.heldKept,
        cost_nodes: result.costNodes,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isOutOfRangeError(error)) {
      // Costs or hours that fit one by one but not once added onto a step.
      // The transaction rolled back: nothing was imported.
      return NextResponse.json(
        { error: 'A cost or hours value in the plan is too large to store once added up on its step. Nothing was imported.' },
        { status: 400 }
      );
    }
    console.error('Ingest apply error:', error);
    return NextResponse.json({ error: 'Failed to apply ingestion plan' }, { status: 500 });
  }
}
