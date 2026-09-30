// LLM structuring path — turn an UNSTRUCTURED document (SDS, EPD, routing sheet,
// or any PDF/HTML/text) into a ProcessModel via an open model on Hugging Face.
// This is what lets the pipeline read documents that have no fixed schema, the
// same job the CLI prototype did with `claude -p`, now in-app with HF_TOKEN.
//
// Discipline: the model NEVER invents a number. It extracts what is in the text;
// anything it cannot ground goes into `notes`, and the plan is still human-gated
// on the review screen before anything is written. Output is validated against
// the ProcessModel schema; a failed parse is surfaced, never guessed.
//
// The DOCUMENT decides the shape of the tree. The model's steps are kept, in
// order, as deep or as flat as the document states them; bad structure is
// REPAIRED (orphans re-homed, tiers made finer than their parent) and every
// repair is noted — it is never replaced by a canned chain. Long documents are
// read in parts and merged, never silently cut.

import { HF_ROUTER_URL, INSIGHTS_DEFAULT_MODEL } from '@/lib/insights/prompt';
import type { IngestNode, ProcessModel, Tier } from './schema';
import { TIER_RANK, validateProcessModel } from './schema';

export type DocHint = 'sds' | 'epd' | 'routing' | 'bom' | 'generic';

const HINTS: Record<DocHint, string> = {
  sds: [
    'This is a GHS Safety Data Sheet for one product (a coating, chemical, etc.).',
    'Create the product node and ONE operation node named for what the sheet describes',
    '(e.g. "Composition (SDS section 3)"). Extract SECTION 3 (Composition / Information on',
    'Ingredients): each listed substance becomes an INPUT flow on that operation. Use the',
    'stated weight percentage as the quantity with unit "%" (mid-point of any range). Add a',
    'note that "%" composition needs a product mass to become an absolute material impact.',
  ].join(' '),
  epd: [
    'This is an Environmental Product Declaration (ISO 14025 / EN 15804).',
    'Create the product node and ONE operation node for the declared product. Extract the',
    'declared unit and the stated Global Warming Potential (GWP, kg CO2e) per declared unit',
    '— as an OUTPUT flow named "Carbon Dioxide" with that value and unit "kg" on that',
    'operation. Note that this is a supplier-specific published factor for a purchased',
    'material, and name the declared unit in the description.',
  ].join(' '),
  routing: [
    'This is a manufacturing routing / process (traveler) sheet: a sequence of operations to',
    'make a product. List EVERY operation the document states, in document order, as one',
    '"operation" node each, keeping the document\'s own step number in the name (e.g.',
    '"20. MIG weld main triangle"). Group operations under a "subprocess" (work center,',
    'module, department) or "machine_line" (line, cell, area) node ONLY when the document',
    'itself names that grouping; otherwise the operation\'s parent is the product. Where',
    'setup/run/labor/machine HOURS are given, add them as costs (category "labor") on THAT',
    'operation, stating the hours in the basis. Only use numbers present in the sheet.',
  ].join(' '),
  bom: [
    'This is a bill of materials: each line is a part or material of the product. Create the',
    'product node and ONE operation node "Purchased materials". Each line with a MASS (or a',
    'count AND a per-part weight: multiply them) becomes an INPUT flow on that operation, with',
    'the material (or part name) as substance_text and the mass and unit as written. Put a',
    'line cost (or unit cost × quantity) as a "material" cost. A line with only a count and',
    'no weight gets a note, not a flow. Do not count an assembly line and its parts twice.',
  ].join(' '),
  generic:
    'This is a manufacturing document. Extract the process steps it names (as operation ' +
    'nodes) and the material, energy and cost facts it states, attached to the step they ' +
    'belong to.',
};

const CONTRACT = `You convert manufacturing-document text into a STRICT JSON process model for a
life-cycle assessment tool. Return ONLY a JSON object (no prose, no markdown fences) of exactly:
{
  "product_name": string,
  "case_name": string,
  "nodes": [{"name": string, "tier": "product"|"machine_line"|"subprocess"|"operation"|"elemental_task", "parent": string|null, "description": string, "quantity": number|null, "unit": string|null}],
  "flows": [{"node": string, "substance_text": string, "direction": "input"|"output", "quantity": number, "unit": string}],
  "costs": [{"node": string, "category": "labor"|"energy"|"material"|"transportation"|"opex"|"capex", "amount": number, "basis": string}],
  "notes": [string]
}
RULES:
- NODES are PROCESS STEPS, never materials/substances. Materials, chemicals, energy, and emissions are FLOWS, not nodes. Never create one node per ingredient.
- Exactly one "product" node (parent null): the finished good.
- Use as many or as few levels as the DOCUMENT has. Tiers from coarse to fine: product > machine_line > subprocess > operation > elemental_task. A child must be finer than its parent, but levels may be skipped: an operation can sit directly under the product. Never add a grouping level the document does not name, and never merge or drop steps.
- Every numbered step is its own "operation". Never put a step under another step; a step's parent is a grouping the document names, or the product. Only a sub-numbered step (e.g. 20.1 under 20) is an "elemental_task" under its step.
- "parent" is the exact name of another node.
- Attach each flow and cost to the node it belongs to (usually an operation), using that node's exact name.
- NEVER invent a number. Use only values present in the text. If a value is absent, omit the flow/cost and add a note. Do not estimate.
- "case_name" should start with "Ingested: ".
- Keep it faithful; put anything you could not parse into "notes".`;

export const LLM_STRUCTURE_DEFAULT_MODEL = INSIGHTS_DEFAULT_MODEL;

/** One model call reads at most this much text; longer documents go in parts. */
export const CHUNK_CHARS = 12000;
/** Upper bound on parts per document (keeps a preview inside the route's time limit). */
export const MAX_CHUNKS = 8;
/** Parts read in parallel. */
export const LLM_CONCURRENCY = 4;
/** One model call is aborted after this long; the other parts still count. */
export const LLM_PART_TIMEOUT_MS = 25_000;
/**
 * No new part starts after this much time. With 8 parts, 4 at a time and a
 * 25 s part timeout, the whole read ends before the route's 60 s maxDuration.
 */
export const LLM_BUDGET_MS = 50_000;

/** Build the {system, user} messages for one structuring call. */
export function buildStructurePrompt(
  text: string,
  hint: DocHint,
  docName: string,
  part?: { index: number; total: number },
): { system: string; user: string } {
  const system = `${CONTRACT}\n\nDOCUMENT-TYPE GUIDANCE: ${HINTS[hint]}`;
  const partNote =
    part && part.total > 1
      ? ` (part ${part.index + 1} of ${part.total}: list only the steps and facts in this part, ` +
        'and repeat the same product node and any grouping node a step belongs to)'
      : '';
  const user = `Document file: ${docName}${partNote}\n\nExtracted text:\n${text.slice(0, CHUNK_CHARS)}`;
  return { system, user };
}

/** Split text into parts of at most `size` chars, on line boundaries where possible. */
export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let cur = '';
  for (const line of text.split(/\r?\n/)) {
    let rest = line;
    // A line longer than a part (PDF text often has no line breaks) is hard-split.
    while (rest.length > size) {
      if (cur) {
        chunks.push(cur);
        cur = '';
      }
      chunks.push(rest.slice(0, size));
      rest = rest.slice(size);
    }
    if (cur && cur.length + rest.length + 1 > size) {
      chunks.push(cur);
      cur = '';
    }
    cur = cur ? `${cur}\n${rest}` : rest;
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

/** Pull the first balanced JSON object out of a model response. */
export function extractJson(raw: string): any | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Concatenate the JSON the model returned for each part of a document. */
export function mergeModelJson(parts: any[]): any {
  const merged: any = { product_name: '', case_name: '', nodes: [], flows: [], costs: [], notes: [] };
  for (const p of parts) {
    if (!p || typeof p !== 'object') continue;
    if (!merged.product_name && p.product_name) merged.product_name = p.product_name;
    if (!merged.case_name && p.case_name) merged.case_name = p.case_name;
    for (const k of ['nodes', 'flows', 'costs', 'notes']) {
      if (Array.isArray(p[k])) merged[k].push(...p[k]);
    }
  }
  return merged;
}

/**
 * The numbered steps a routing's text states ("10 Cut…", "Op 20. Weld…",
 * "Step 3: …"), step number → the line as written. Used to catch steps the
 * model skipped.
 */
export function numberedStepLines(text: string): Map<string, string> {
  const steps = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:op(?:eration)?\.?\s*(?:no\.?\s*)?|step\s*)?(\d{1,4})\s*[.):-]?\s+([A-Za-z].*)$/i);
    if (m && !steps.has(m[1])) steps.set(m[1], m[2].trim());
  }
  return steps;
}

export function countNumberedSteps(text: string): number {
  return numberedStepLines(text).size;
}

const TIERS: Tier[] = ['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'];
const tierAt = (rank: number): Tier => TIERS[Math.min(5, Math.max(1, rank)) - 1];
const COST_CATEGORIES = new Set(['labor', 'energy', 'material', 'transportation', 'opex', 'capex']);

const clean = (s: unknown, max = 118): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[$,%]/g, ''));
  return Number.isFinite(n) ? n : null;
};
/** The step number a name starts with ("20. Weld" → "20", "20.1 Tack" → "20.1"). */
const stepNo = (s: string): string | null => {
  const m = s.match(/^\s*(?:op(?:eration)?\.?\s*(?:no\.?\s*)?|step\s*)?(\d{1,5}(?:\.\d+)*)(?!\d)/i);
  return m ? m[1] : null;
};
/** "20.1" is a sub-step of "20"; "30" is not a sub-step of "20". */
const isSubStepOf = (child: string | null, parent: string | null): boolean =>
  !!child && !!parent && child.startsWith(`${parent}.`);
/** Top-level step number, for matching "Op 20" to "20. Weld". */
const mainStepNo = (s: string): string | null => stepNo(s)?.split('.')[0] ?? null;

/**
 * Turn the model's JSON into a VALID ProcessModel while keeping the tree the
 * document describes. Repairs, each noted: unknown or missing parents are
 * re-homed under the product; a missing tier is inferred (a step with children
 * is a subprocess, one without is an operation); a child that is not finer
 * than its parent is made finer; repeated names across parts are merged.
 * Materials the model wrongly made into leaf nodes are salvaged into flows.
 */
export function toProcessModel(
  json: any,
  docName: string,
  opts: { hint?: DocHint; text?: string } = {},
): ProcessModel {
  if (!json || typeof json !== 'object') throw new Error('LLM returned no JSON object');
  const prov = { doc: docName, locator: `LLM-structured from ${docName}` };
  const notes: string[] = Array.isArray(json.notes) ? json.notes.map(String) : [];
  const repairs: string[] = [];
  const nestedMoves: string[] = []; // step numbers moved out from under another step

  const rawNodes: any[] = (Array.isArray(json.nodes) ? json.nodes : []).filter(
    (n: any) => n && clean(n.name),
  );
  const product =
    clean(json.product_name) || clean(rawNodes.find((n) => n.tier === 'product')?.name) || 'Ingested product';
  const productKeys = new Set(
    [product, ...rawNodes.filter((n) => n.tier === 'product').map((n) => clean(n.name))].map((s) =>
      s.toLowerCase(),
    ),
  );

  // 1. Candidate steps, in document order. The same step repeated by several
  //    parts (same name, same parent) is merged; a different step that reuses
  //    a name is kept under a suffixed name.
  type Step = { name: string; tier: Tier | null; parentRef: string | null; raw: any };
  const steps: Step[] = [];
  const byKey = new Map<string, Step>();
  for (const n of rawNodes) {
    let name = clean(n.name);
    if (n.tier === 'product' && productKeys.has(name.toLowerCase())) continue; // the root
    if (productKeys.has(name.toLowerCase())) name = clean(`${name} (step)`);
    const parentRef = n.parent == null || n.parent === '' ? null : clean(n.parent);
    const existing = byKey.get(name.toLowerCase());
    if (existing) {
      if ((existing.parentRef ?? '').toLowerCase() === (parentRef ?? '').toLowerCase()) continue;
      let i = 2;
      while (byKey.has(`${name} (${i})`.toLowerCase())) i++;
      repairs.push(`two different steps are both called '${name}'; the second is kept as '${name} (${i})'`);
      name = `${name} (${i})`;
    }
    const tier = TIERS.includes(n.tier) && n.tier !== 'product' ? (n.tier as Tier) : null;
    const step: Step = { name, tier, parentRef, raw: n };
    byKey.set(name.toLowerCase(), step);
    steps.push(step);
  }

  // 2. Salvage: when the model gave no flows but typed materials as leaf NODES
  //    (a childless elemental_task carrying a quantity), turn them into flows.
  const salvaged: Array<{ step: Step; qty: number | null }> = [];
  const hasModelFlows = Array.isArray(json.flows) && json.flows.some((f: any) => f?.substance_text);
  if (!hasModelFlows) {
    const isParent = (s: Step) => steps.some((o) => o.parentRef?.toLowerCase() === s.name.toLowerCase());
    for (const s of [...steps]) {
      if (s.tier === 'elemental_task' && !isParent(s) && (num(s.raw.quantity) !== null || s.raw.unit)) {
        salvaged.push({ step: s, qty: num(s.raw.quantity) });
        steps.splice(steps.indexOf(s), 1);
        byKey.delete(s.name.toLowerCase());
      }
    }
  }

  // 3. Place steps parent-first. Unknown parents → product; cycles → product.
  const nodes: IngestNode[] = [
    { name: product, tier: 'product', parent: null, quantity: 1, unit: 'unit', provenance: prov },
  ];
  const placed = new Map<string, IngestNode>([[product.toLowerCase(), nodes[0]]]);
  const hasChildRef = (s: Step) =>
    steps.some((o) => o !== s && o.parentRef?.toLowerCase() === s.name.toLowerCase());
  let pending = [...steps];
  while (pending.length) {
    const next: Step[] = [];
    let progressed = false;
    for (const s of pending) {
      const ref = s.parentRef?.toLowerCase() ?? null;
      let parent: IngestNode | undefined;
      if (ref === null || productKeys.has(ref)) parent = nodes[0];
      else if (placed.has(ref)) parent = placed.get(ref);
      else if (!byKey.has(ref)) {
        parent = nodes[0];
        repairs.push(`'${s.name}' named an unknown parent '${s.parentRef}'; placed under the product`);
      }
      if (!parent) {
        next.push(s); // parent exists but is not placed yet
        continue;
      }
      // A numbered step is a process step, never a grouping: a step the model
      // nested under another step moves beside it (a true sub-step such as
      // 20.1 under 20 stays nested as a task).
      const own = stepNo(s.name);
      const parentNo = stepNo(parent.name);
      let tier: Tier = s.tier ?? (hasChildRef(s) ? 'subprocess' : 'operation');
      if (own) {
        if (parentNo && isSubStepOf(own, parentNo)) {
          tier = 'elemental_task';
        } else {
          if (parentNo) {
            nestedMoves.push(own);
            parent = placed.get((parent.parent ?? product).toLowerCase()) ?? nodes[0];
          }
          tier = 'operation';
        }
      }
      if (TIER_RANK[tier] <= TIER_RANK[parent.tier]) {
        if (TIER_RANK[parent.tier] < 5) {
          const finer = tierAt(TIER_RANK[parent.tier] + 1);
          repairs.push(`'${s.name}' was a ${tier} under the ${parent.tier} '${parent.name}'; made it a ${finer}`);
          tier = finer;
        } else {
          const grand = placed.get((parent.parent ?? product).toLowerCase()) ?? nodes[0];
          repairs.push(`'${s.name}' sat under the finest step '${parent.name}'; placed beside it`);
          parent = grand;
          tier = parent === nodes[0] ? 'operation' : tierAt(TIER_RANK[parent.tier] + 1);
        }
      }
      const node: IngestNode = {
        name: s.name,
        tier,
        parent: parent.name,
        description: s.raw.description ? String(s.raw.description).slice(0, 500) : undefined,
        quantity: num(s.raw.quantity),
        unit: s.raw.unit ? String(s.raw.unit).slice(0, 20) : null,
        provenance: prov,
      };
      nodes.push(node);
      placed.set(s.name.toLowerCase(), node);
      progressed = true;
    }
    if (!progressed) {
      for (const s of next) {
        repairs.push(`'${s.name}' was part of a parent loop; placed under the product`);
        s.parentRef = null;
      }
    }
    pending = next;
  }

  // 4. Flows and costs go to the step they name: exact name, then the step
  //    number, then a unique partial name. Anything unresolvable is attached
  //    to the product and called out for the reviewer.
  const resolve = (ref: unknown): string | null => {
    const r = clean(ref).toLowerCase();
    if (!r) return null;
    const exact = placed.get(r);
    if (exact) return exact.name;
    const no = stepNo(r);
    if (no) {
      let hits = nodes.filter((n) => stepNo(n.name) === no);
      if (!hits.length) hits = nodes.filter((n) => mainStepNo(n.name) === no && stepNo(n.name) === mainStepNo(n.name));
      if (hits.length === 1) return hits[0].name;
    }
    if (r.length >= 4) {
      const hits = nodes.filter((n) => {
        const nm = n.name.toLowerCase();
        return n.tier !== 'product' && (nm.includes(r) || r.includes(nm));
      });
      if (hits.length === 1) return hits[0].name;
    }
    return null;
  };
  const terminal = nodes.filter((n) => !nodes.some((c) => c.parent === n.name));
  const homeFor = (ref: unknown, what: string): string => {
    const hit = resolve(ref);
    if (hit) return hit;
    if (terminal.length === 1) return terminal[0].name;
    repairs.push(`could not tell which step ${what} belongs to ('${clean(ref) || 'none given'}'); attached to the product — move it to the right step`);
    return product;
  };

  const flows: ProcessModel['flows'] = [];
  for (const f of Array.isArray(json.flows) ? json.flows : []) {
    const q = num(f?.quantity);
    if (!f?.substance_text || q === null) continue;
    flows.push({
      node: homeFor(f.node, `the flow '${clean(f.substance_text, 60)}'`),
      substance_text: String(f.substance_text).slice(0, 200),
      direction: f.direction === 'output' ? 'output' : 'input',
      quantity: q,
      unit: String(f.unit ?? 'unit').slice(0, 20),
      provenance: prov,
    });
  }
  for (const { step, qty } of salvaged) {
    const home = step.parentRef ? resolve(step.parentRef) ?? product : product;
    flows.push({
      node: home,
      substance_text: step.name.slice(0, 200),
      direction: 'input',
      quantity: qty ?? 0,
      unit: String(step.raw.unit ?? '%').slice(0, 20),
      provenance: prov,
    });
  }
  if (salvaged.length) notes.push('Recovered composition items the model had mis-typed as nodes.');

  const costs: ProcessModel['costs'] = [];
  for (const c of Array.isArray(json.costs) ? json.costs : []) {
    const amt = num(c?.amount);
    if (amt === null || amt === 0) continue;
    costs.push({
      node: homeFor(c.node, `a ${clean(c.category, 20) || 'cost'} cost`),
      category: COST_CATEGORIES.has(c?.category) ? c.category : 'opex',
      amount: amt,
      basis: String(c?.basis ?? '').slice(0, 200),
      provenance: prov,
    });
  }

  // 5. Did the model drop steps? When most of the text's numbered lines were
  //    extracted (so they really are the routing's steps), any it skipped are
  //    added word for word from the document — a step is never lost. Otherwise
  //    the reviewer is warned.
  if (opts.hint === 'routing' && opts.text) {
    const textSteps = numberedStepLines(opts.text);
    const have = new Set(nodes.map((n) => mainStepNo(n.name)).filter(Boolean) as string[]);
    const missing = [...textSteps.entries()].filter(([k]) => !have.has(k));
    const overlap = textSteps.size - missing.length;
    if (missing.length && overlap >= Math.ceil(textSteps.size / 2)) {
      for (const [k, line] of missing) {
        let name = clean(`${k}. ${line}`);
        while (placed.has(name.toLowerCase())) name = clean(`${name} (from text)`);
        const node: IngestNode = {
          name,
          tier: 'operation',
          parent: product,
          provenance: { doc: docName, locator: `${prov.locator}, step ${k}`, snippet: line.slice(0, 200) },
        };
        // Keep document order: after the last step numbered below this one.
        const idx = nodes.reduce(
          (at, n, i) => (Number(mainStepNo(n.name) ?? NaN) < Number(k) ? i : at),
          0,
        );
        nodes.splice(idx + 1, 0, node);
        placed.set(name.toLowerCase(), node);
      }
      notes.push(
        `Added ${missing.length} step(s) the model skipped, taken word for word from the document: ${missing
          .map(([k]) => k)
          .join(', ')}.`,
      );
    } else if (missing.length) {
      notes.push(
        `The document appears to list ${textSteps.size} numbered steps but ${overlap} were extracted — check for missing steps before applying.`,
      );
    }
  }
  if (nestedMoves.length) {
    repairs.unshift(
      `${nestedMoves.length} step(s) the model nested under another step were moved back beside it (steps ${nestedMoves.join(', ')})`,
    );
  }
  if (repairs.length) notes.push(`Structure repaired: ${repairs.join('; ')}.`);

  const pm: ProcessModel = {
    product_name: product,
    case_name: String(json.case_name ?? `Ingested: ${product}`).slice(0, 100) || `Ingested: ${product}`.slice(0, 100),
    nodes,
    flows,
    costs,
    source_docs: [docName],
    notes,
  };
  const errors = validateProcessModel(pm);
  if (errors.length) pm.notes.push(`Structure warnings: ${errors.join('; ')}`);
  return pm;
}

/** Run `fn` over `items` with at most `limit` in flight, keeping input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Structure a document via the HF open model. Long documents are read in parts
 * (in parallel, merged in order). Each part has its own timeout, and a part
 * that fails (network error, timeout, HTTP error, bad JSON) becomes a note
 * instead of failing the others. Parts that would start after the overall
 * budget are skipped and noted. Returns the ProcessModel, or throws if no key
 * is configured or no part produced valid JSON (caller turns that into a
 * clear API error). Upstream response bodies are logged, never returned.
 */
export async function structureWithLLM(
  text: string,
  hint: DocHint,
  docName: string,
  opts: { partTimeoutMs?: number; budgetMs?: number; concurrency?: number } = {},
): Promise<ProcessModel> {
  const token = process.env.HF_TOKEN;
  if (!token) {
    throw new Error(
      'LLM structuring needs an HF_TOKEN (Hugging Face). Add it to run SDS/EPD/routing connectors.',
    );
  }
  const model = process.env.HF_INSIGHTS_MODEL || LLM_STRUCTURE_DEFAULT_MODEL;
  const all = chunkText(text);
  const chunks = all.slice(0, MAX_CHUNKS);
  const partTimeoutMs = opts.partTimeoutMs ?? LLM_PART_TIMEOUT_MS;
  const deadline = Date.now() + (opts.budgetMs ?? LLM_BUDGET_MS);

  const callPart = async (chunk: string, index: number): Promise<{ json: any } | { error: string }> => {
    if (Date.now() >= deadline) {
      return { error: 'not read: the time budget for this preview ran out' };
    }
    const { system, user } = buildStructurePrompt(chunk, hint, docName, { index, total: chunks.length });
    try {
      const res = await fetch(HF_ROUTER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.1, // deterministic extraction
          max_tokens: 8000, // room for a long routing's every operation
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(partTimeoutMs),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        console.warn(`[llm-structure] part ${index + 1}: HTTP ${res.status}: ${String(detail).slice(0, 200)}`);
        return { error: `HF structuring failed (HTTP ${res.status})` };
      }
      const body = await res.json();
      const json = extractJson(body?.choices?.[0]?.message?.content ?? '');
      return json ? { json } : { error: 'The model did not return parseable JSON for this part.' };
    } catch (e: any) {
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      console.warn(`[llm-structure] part ${index + 1}:`, e?.message ?? e);
      return {
        error: timedOut
          ? `the model call timed out after ${Math.round(partTimeoutMs / 1000)} s`
          : 'the model could not be reached',
      };
    }
  };

  const results = await mapLimit(chunks, opts.concurrency ?? LLM_CONCURRENCY, callPart);
  const good = results.filter((r): r is { json: any } => 'json' in r);
  if (!good.length) {
    const first = results.find((r): r is { error: string } => 'error' in r);
    throw new Error(first?.error ?? 'The model did not return parseable JSON for this document.');
  }
  const merged = mergeModelJson(good.map((r) => r.json));
  results.forEach((r, i) => {
    if ('error' in r) merged.notes.push(`Part ${i + 1} of ${chunks.length} could not be read: ${r.error}`);
  });
  if (all.length > 1) {
    merged.notes.push(
      all.length > MAX_CHUNKS
        ? `Only the first ${MAX_CHUNKS} of ${all.length} parts (about ${MAX_CHUNKS * CHUNK_CHARS} of ${text.length} characters) were read; the rest of the document was not structured.`
        : `Read the whole document in ${all.length} parts (${text.length} characters).`,
    );
  }
  return toProcessModel(merged, docName, { hint, text: chunks.join('\n') });
}
