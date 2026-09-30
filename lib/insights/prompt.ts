// Grounded-narration prompt builder for Magic Insights.
//
// The engine computes every number (contributor shares, totals, feasibility
// math). The open model's ONLY job is to phrase and reason over those
// computed facts and answer the user's free-text question — it must never
// produce a new figure. This is the same "never invents numbers" discipline
// the ingestion pipeline follows; it is what keeps AI narration defensible
// in an LCA context.
//
// Pure and dependency-free so it can be unit-tested and reused server-side.

export interface InsightContributor {
  name: string;
  pct: number;   // share of the active category, 0-100
  value: number; // absolute impact in the category unit
}

export interface InsightFacts {
  caseName: string;
  method: string;
  categoryLabel: string;        // e.g. "Global Warming" or "environmental load"
  total?: { value: number; unit: string };
  totalCost?: number;
  contributors: InsightContributor[];
  /** The same result grouped by material (one material can span several steps). */
  materials?: InsightContributor[];
  /** Consultant read: levers triggered by this case (title, why, concrete moves). */
  levers?: Array<{ title: string; why: string; moves: string[] }>;
  /** Share of total cost by kind (purchased material, labor, energy, other). */
  costSplit?: Array<{ name: string; pct: number }>;
  /** Per step: share of total cost next to share of the active category. */
  stepCosts?: Array<{ name: string; costPct: number; impactPct: number }>;
  mode: 'summary' | 'reduce' | 'tradeoff' | 'base' | 'custom';
  reducePct?: number;
  question?: string;            // free-text question in 'custom' mode
  allCategories?: Array<{ name: string; value: number; unit: string }>; // full impact profile
}

const SYSTEM = [
  'You are a senior sustainability consultant reviewing a manufacturer\'s',
  'life-cycle assessment inside an LCA tool. You have read their process steps,',
  'materials and energy flows. You advise the way a consultant would after',
  'walking the shop floor: which material or step to act on first, and the',
  'concrete move (use less, use recycled or lower-carbon grades, substitute,',
  'ask the supplier for an EPD, change the energy supply or how a machine runs).',
  '',
  'HARD RULES:',
  '1. Use ONLY the figures provided in the FACTS block. Never invent, estimate,',
  '   or extrapolate a number that is not given. Percentages and totals must be',
  '   quoted exactly as provided.',
  '2. If the question cannot be answered from the FACTS, say so plainly and name',
  '   what data would be needed — do not guess.',
  '3. Do not claim a specific characterization factor, emission value, or source',
  '   unless it appears in the FACTS.',
  '4. Be concise: at most ~140 words, plain prose, no markdown headings.',
  '5. Ground every recommendation in the shares given. When a "By material" list',
  '   is given, the biggest lever is its highest-share material (a material can',
  '   span several steps); otherwise the highest-share contributor. NAME it with',
  '   its exact share/value.',
  '6. Be SPECIFIC, never generic. Name the material, step or flow and the',
  '   concrete move. Build on the "Consultant read" levers when given, in their',
  '   order; do not invent levers the facts do not support. Do not do arithmetic',
  '   and do not estimate savings: a what-if is proven by running a copy of the',
  '   case. No platitudes like "consider reducing energy use". Never repeat a point.',
  '7. Each mode must read differently and lead with different figures — a summary,',
  '   a reduction plan, a cost trade-off, and a base comparison are not the same.',
].join('\n');

const MODE_TASK: Record<InsightFacts['mode'], string> = {
  summary:
    'Give a short consultant readout: the total, the material (or step) that ' +
    'drives it with its share, then the two or three moves you would make first ' +
    'and why, drawn from the Consultant read.',
  reduce:
    'Explain how to reduce the active category. Target the highest-share ' +
    'contributor first; if the requested reduction exceeds what the top ' +
    'contributor can deliver, say so honestly and explain what scope change ' +
    'would be required.',
  tradeoff:
    'Set cost against impact using only the cost split and the per-step cost and ' +
    'impact shares given. Say where they sit together and where they part (labor ' +
    'carries cost but no flows in an LCA), then name the move that changes the ' +
    'impact and whether it is a purchasing or a process decision. If no cost facts ' +
    'are given, say the case has no costs yet.',
  base:
    'Explain how to compare copies of this case in Compare Cases, which lists what ' +
    'each copy changes and shows impact and cost side by side: keep the functional unit, method and region ' +
    'the same, change one thing per copy, run each copy, and name the material and ' +
    'steps whose rows will move, with their shares.',
  custom: 'Answer the user question below using only the FACTS.',
};

/** Build the {system, user} messages for the chat completion. */
export function buildInsightMessages(facts: InsightFacts): {
  system: string;
  user: string;
} {
  const factLines: string[] = [
    `Case: ${facts.caseName}`,
    `LCIA method: ${facts.method}`,
    `Active category: ${facts.categoryLabel}`,
  ];
  if (facts.total) {
    factLines.push(`Category total: ${facts.total.value} ${facts.total.unit}`);
  }
  if (facts.totalCost !== undefined) {
    factLines.push(`Total activity-based cost: $${facts.totalCost.toLocaleString()}`);
  }
  if (facts.mode === 'reduce' && facts.reducePct !== undefined) {
    factLines.push(`Requested reduction target: ${facts.reducePct}%`);
  }
  if (facts.allCategories?.length) {
    factLines.push('Full impact profile (all categories for this assessment):');
    for (const c of facts.allCategories) {
      factLines.push(`  - ${c.name}: ${c.value} ${c.unit}`);
    }
  }
  if (facts.contributors.length) {
    factLines.push('Contributors (share of active category, absolute value):');
    for (const c of facts.contributors) {
      factLines.push(`  - ${c.name}: ${c.pct.toFixed(1)}% (${c.value} ${facts.total?.unit ?? ''})`.trimEnd());
    }
  } else {
    factLines.push('Contributors: none available (assessment may not be run yet).');
  }
  if (facts.levers?.length) {
    factLines.push('Consultant read (levers this case triggers; prioritise and explain these, do not invent others):');
    for (const l of facts.levers) {
      factLines.push(`  - ${l.title}: ${l.why}`);
      for (const m of l.moves) factLines.push(`      * ${m}`);
    }
  }
  if (facts.costSplit?.length) {
    factLines.push('Cost split (share of total cost):');
    for (const c of facts.costSplit) factLines.push(`  - ${c.name}: ${c.pct.toFixed(1)}%`);
  }
  if (facts.stepCosts?.length) {
    factLines.push('Steps (share of total cost, share of the active category):');
    for (const st of facts.stepCosts) {
      factLines.push(`  - ${st.name}: cost ${st.costPct.toFixed(1)}%, impact ${st.impactPct.toFixed(1)}%`);
    }
  }
  if (facts.materials?.length) {
    factLines.push('By material (share of active category, absolute value; a material can span several steps):');
    for (const m of facts.materials) {
      factLines.push(`  - ${m.name}: ${m.pct.toFixed(1)}% (${m.value} ${facts.total?.unit ?? ''})`.trimEnd());
    }
  }

  const task = MODE_TASK[facts.mode];
  const userQ =
    facts.mode === 'custom' && facts.question?.trim()
      ? `\n\nUSER QUESTION: ${facts.question.trim()}`
      : '';

  const user = `FACTS:\n${factLines.join('\n')}\n\nTASK: ${task}${userQ}`;
  return { system: SYSTEM, user };
}

export const INSIGHTS_DEFAULT_MODEL = 'openai/gpt-oss-120b:fastest';
export const HF_ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions';

// ── Request validation ───────────────────────────────────────────────────────
// The route accepts facts from the client, so bound them before they reach the
// paid model: known mode, typed fields, capped lists and string lengths, and a
// hard 500-character limit on the free-text question (INS-2).

export const INSIGHT_LIMITS = {
  /** Request body bytes (checked by the route before and while parsing). */
  bodyBytes: 16 * 1024,
  /** Free-text question in custom mode. Longer is rejected, not truncated. */
  question: 500,
  /** Names, labels, units, lever text: truncated to this many characters. */
  text: 200,
  /** contributors / materials / stepCosts entries kept. */
  contributors: 25,
  /** allCategories entries kept. */
  categories: 40,
  /** levers kept, and moves per lever. */
  levers: 10,
  moves: 10,
  /** costSplit entries kept. */
  costSplit: 10,
} as const;

const MODES: ReadonlyArray<InsightFacts['mode']> = ['summary', 'reduce', 'tradeoff', 'base', 'custom'];

class FactsError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function text(v: unknown, field: string, max: number = INSIGHT_LIMITS.text): string {
  if (typeof v !== 'string') throw new FactsError(`${field} must be text`);
  return v.slice(0, max);
}

function num(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new FactsError(`${field} must be a number`);
  return v;
}

function optNum(v: unknown, field: string): number | undefined {
  return v === undefined || v === null ? undefined : num(v, field);
}

function list<T>(v: unknown, field: string, max: number, item: (x: unknown, i: number) => T): T[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new FactsError(`${field} must be a list`);
  return v.slice(0, max).map((x, i) => item(x, i));
}

function contributor(field: string) {
  return (x: unknown, i: number): InsightContributor => {
    if (!isObj(x)) throw new FactsError(`${field}[${i}] must be an object`);
    return {
      name: text(x.name, `${field}[${i}].name`),
      pct: num(x.pct, `${field}[${i}].pct`),
      value: num(x.value, `${field}[${i}].value`),
    };
  };
}

/** Validate and bound client-supplied facts. */
export function sanitizeInsightFacts(
  raw: unknown
): { ok: true; facts: InsightFacts } | { ok: false; error: string } {
  try {
    if (!isObj(raw)) throw new FactsError('Body must be a JSON object');
    const mode = raw.mode as InsightFacts['mode'];
    if (!MODES.includes(mode)) throw new FactsError(`mode must be one of ${MODES.join(', ')}`);

    let question: string | undefined;
    if (raw.question !== undefined && raw.question !== null) {
      if (typeof raw.question !== 'string') throw new FactsError('question must be text');
      if (raw.question.length > INSIGHT_LIMITS.question) {
        throw new FactsError(`question must be at most ${INSIGHT_LIMITS.question} characters`);
      }
      question = raw.question;
    }

    let total: InsightFacts['total'];
    if (raw.total !== undefined && raw.total !== null) {
      if (!isObj(raw.total)) throw new FactsError('total must be an object');
      total = { value: num(raw.total.value, 'total.value'), unit: text(raw.total.unit ?? '', 'total.unit') };
    }

    const facts: InsightFacts = {
      caseName: text(raw.caseName ?? '', 'caseName'),
      method: text(raw.method ?? '', 'method'),
      categoryLabel: text(raw.categoryLabel ?? '', 'categoryLabel'),
      total,
      totalCost: optNum(raw.totalCost, 'totalCost'),
      contributors:
        list(raw.contributors ?? [], 'contributors', INSIGHT_LIMITS.contributors, contributor('contributors')) ?? [],
      materials: list(raw.materials, 'materials', INSIGHT_LIMITS.contributors, contributor('materials')),
      levers: list(raw.levers, 'levers', INSIGHT_LIMITS.levers, (x, i) => {
        if (!isObj(x)) throw new FactsError(`levers[${i}] must be an object`);
        return {
          title: text(x.title, `levers[${i}].title`),
          why: text(x.why ?? '', `levers[${i}].why`, INSIGHT_LIMITS.question),
          moves:
            list(x.moves ?? [], `levers[${i}].moves`, INSIGHT_LIMITS.moves, (m, j) =>
              text(m, `levers[${i}].moves[${j}]`)
            ) ?? [],
        };
      }),
      costSplit: list(raw.costSplit, 'costSplit', INSIGHT_LIMITS.costSplit, (x, i) => {
        if (!isObj(x)) throw new FactsError(`costSplit[${i}] must be an object`);
        return { name: text(x.name, `costSplit[${i}].name`), pct: num(x.pct, `costSplit[${i}].pct`) };
      }),
      stepCosts: list(raw.stepCosts, 'stepCosts', INSIGHT_LIMITS.contributors, (x, i) => {
        if (!isObj(x)) throw new FactsError(`stepCosts[${i}] must be an object`);
        return {
          name: text(x.name, `stepCosts[${i}].name`),
          costPct: num(x.costPct, `stepCosts[${i}].costPct`),
          impactPct: num(x.impactPct, `stepCosts[${i}].impactPct`),
        };
      }),
      mode,
      reducePct: optNum(raw.reducePct, 'reducePct'),
      question,
      allCategories: list(raw.allCategories, 'allCategories', INSIGHT_LIMITS.categories, (x, i) => {
        if (!isObj(x)) throw new FactsError(`allCategories[${i}] must be an object`);
        return {
          name: text(x.name, `allCategories[${i}].name`),
          value: num(x.value, `allCategories[${i}].value`),
          unit: text(x.unit ?? '', `allCategories[${i}].unit`),
        };
      }),
    };
    return { ok: true, facts };
  } catch (e) {
    if (e instanceof FactsError) return { ok: false, error: e.message };
    throw e;
  }
}
