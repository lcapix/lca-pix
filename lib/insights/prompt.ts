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
  mode: 'summary' | 'reduce' | 'tradeoff' | 'base' | 'custom';
  reducePct?: number;
  question?: string;            // free-text question in 'custom' mode
}

const SYSTEM = [
  'You are a life-cycle assessment (LCA) analyst embedded in a professional',
  'LCA tool. You explain assessment results to a sustainability engineer who',
  'will defend them to a committee.',
  '',
  'HARD RULES:',
  '1. Use ONLY the figures provided in the FACTS block. Never invent, estimate,',
  '   or extrapolate a number that is not given. Percentages and totals must be',
  '   quoted exactly as provided.',
  '2. If the question cannot be answered from the FACTS, say so plainly and name',
  '   what data would be needed — do not guess.',
  '3. Do not claim a specific characterization factor, emission value, or source',
  '   unless it appears in the FACTS.',
  '4. Be concise: at most ~150 words, plain prose, no markdown headings, no',
  '   bullet lists unless the user asked for a list.',
  '5. Ground every recommendation in the contributor shares given: the biggest',
  '   lever is the highest-share contributor.',
].join('\n');

const MODE_TASK: Record<InsightFacts['mode'], string> = {
  summary:
    'Give a 3-4 sentence executive summary of this assessment: the total, the ' +
    'single biggest contributor and its share, and what that concentration means ' +
    'for where to focus.',
  reduce:
    'Explain how to reduce the active category. Target the highest-share ' +
    'contributor first; if the requested reduction exceeds what the top ' +
    'contributor can deliver, say so honestly and explain what scope change ' +
    'would be required.',
  tradeoff:
    'Discuss the cost-vs-impact trade-off using the contributor shares and the ' +
    'total cost. Identify where an impact cut is likely "cheap" vs "expensive" ' +
    'in dollar terms, and how to find the best dollars-per-unit-impact moves.',
  base:
    'Explain what to look for when comparing this case against its base ' +
    'scenario: which components are most likely to drive the delta, and the ' +
    'kind of cost/impact trade-off the comparison view will surface.',
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
  if (facts.contributors.length) {
    factLines.push('Contributors (share of active category, absolute value):');
    for (const c of facts.contributors) {
      factLines.push(`  - ${c.name}: ${c.pct.toFixed(1)}% (${c.value} ${facts.total?.unit ?? ''})`.trimEnd());
    }
  } else {
    factLines.push('Contributors: none available (assessment may not be run yet).');
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
