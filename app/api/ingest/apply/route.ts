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
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { convertQuantity } from '@/lib/units';
import type { IngestCost, IngestNode } from '@/lib/ingest/schema';
import type { MappedFlow } from '@/lib/ingest/maplca';
import { nodeDepths, validateProcessModel } from '@/lib/ingest/schema';

const COST_COLUMN: Record<string, string> = {
  labor: 'labor_cost',
  energy: 'energy_cost',
  material: 'material_cost',
  transportation: 'transportation_cost',
  opex: 'opex',
  capex: 'capex',
};

/** The cost column for a category, own keys only ("constructor" is not a column). */
const costColumn = (category: unknown): string | undefined =>
  typeof category === 'string' && Object.hasOwn(COST_COLUMN, category) ? COST_COLUMN[category] : undefined;

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
});

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
      const denied = await projectAccessDenied(userId, caseRow.project_id, 'editor', { notFound: 'Target case not found' });
      if (denied) return denied;
      // Each line goes to its own step (chosen at review); every step must be
      // part of this case. The body's attach_component_id is the default for
      // lines without one; a line with neither is held, never guessed.
      const caseComponents = await query<any>(
        `SELECT component_id, component_name FROM component WHERE case_id = ?`,
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

      // Factor-unit lookup for the unit guard (same discipline as create mode).
      const substanceIds = [...new Set(flows.map((f) => f.substance_id).filter(Boolean))] as number[];
      const unitBySubstance = new Map<number, string | null>();
      for (const sid of substanceIds) {
        const row = await queryOne<any>(`SELECT unit FROM substances WHERE substance_id = ?`, [sid]);
        unitBySubstance.set(sid, row?.unit ?? null);
      }

      const skippedFlows: string[] = [];
      const appendResult = await transaction(async (conn) => {
        let applied = 0;
        let held = 0;
        const usedSteps = new Set<number>();
        for (const f of flows) {
          if (!f.substance_id) {
            held++;
            skippedFlows.push(`${f.substance_text}: no confirmed substance match`);
            continue;
          }
          const target = stepFor(f);
          if (!target) {
            held++;
            skippedFlows.push(`${f.substance_text}: no step chosen`);
            continue;
          }
          // lib/units decides, as the engine will ('Mg' is not 'mg').
          const factorUnit = unitBySubstance.get(f.substance_id);
          if (factorUnit && !convertQuantity(1, f.unit, factorUnit)) {
            held++;
            skippedFlows.push(
              `${f.substance_text}: unit '${f.unit}' cannot convert to factor unit '${factorUnit}'`
            );
            continue;
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
        for (const c of costs) {
          const col = costColumn(c.category);
          const target = stepFor(c);
          if (!col) continue;
          if (!target) {
            skippedFlows.push(`${c.category} cost ${c.amount}: no step chosen`);
            continue;
          }
          const key = `${target}|${col}`;
          totals.set(key, (totals.get(key) ?? 0) + Number(c.amount || 0));
          usedSteps.add(target);
        }
        for (const [key, amount] of totals) {
          const [id, col] = key.split('|');
          await conn.query(
            `UPDATE component SET ${col} = COALESCE(${col}, 0) + ? WHERE component_id = ?`,
            [amount, Number(id)]
          );
        }

        // The document's name only (a flow's provenance also carries its row).
        const sourceDoc =
          costs[0]?.provenance?.doc || String(flows[0]?.provenance ?? '').split(' · ')[0] || 'a document';
        await conn.query(
          `UPDATE case_table
              SET description = LEFT(CONCAT(COALESCE(description, ''), ?), 2000)
            WHERE case_id = ?`,
          [
            ` Added ${sourceDoc}: ${applied} flow(s) on ${usedSteps.size} step(s).`.slice(0, 900),
            targetCaseId,
          ]
        );

        return { applied, held, costCols: totals.size, steps: [...usedSteps] };
      });

      return NextResponse.json(
        {
          success: true,
          appended: true,
          case_id: targetCaseId,
          attach_component_id: attachComponentId,
          steps_used: appendResult.steps.map((id) => nameById.get(id)),
          flows_applied: appendResult.applied,
          flows_held_for_review: appendResult.held,
          held_details: skippedFlows,
          cost_columns_updated: appendResult.costCols,
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

    // Factor-unit lookup for the unit guard, outside the transaction.
    const substanceIds = [...new Set(flows.map((f) => f.substance_id).filter(Boolean))] as number[];
    const unitBySubstance = new Map<number, string | null>();
    for (const sid of substanceIds) {
      const row = await queryOne<any>(`SELECT unit FROM substances WHERE substance_id = ?`, [sid]);
      unitBySubstance.set(sid, row?.unit ?? null);
    }

    const skippedFlows: string[] = [];

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
            WHERE project_id = ? AND LOWER(TRIM(case_name)) = LOWER(TRIM(?)) LIMIT 1`,
          [projectId, uniqueName]
        );
        if (!taken) break;
        // The number is added here, so the base is cut to leave room for it.
        const suffix = ` (${n})`;
        uniqueName = `${fitToColumn(caseName, { kind: 'chars', max: COLUMN_LIMITS.case_table.case_name.max - suffix.length })}${suffix}`;
      }
      const [caseIns]: any = await conn.query(
        `INSERT INTO case_table (project_id, case_name, case_type, description)
         VALUES (?, ?, 'base', ?)`,
        [projectId, uniqueName, `Built from ${sourceDoc}.`.slice(0, 1000)]
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
          continue;
        }
        const componentId = idByName.get(f.node);
        if (!componentId) {
          held++;
          skippedFlows.push(`${f.substance_text} (${f.node}): node not in plan`);
          continue;
        }
        // lib/units decides, as the engine will ('Mg' is not 'mg').
        const factorUnit = unitBySubstance.get(f.substance_id);
        if (factorUnit && !convertQuantity(1, f.unit, factorUnit)) {
          held++;
          skippedFlows.push(
            `${f.substance_text} (${f.node}): unit '${f.unit}' cannot convert to factor unit '${factorUnit}'`
          );
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
        if (!col || !componentId) continue;
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

      return { caseId, caseName: uniqueName, components: idByName.size, applied, held, costNodes: costByNode.size };
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
