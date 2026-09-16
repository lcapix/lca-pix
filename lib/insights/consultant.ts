// The consultant read: what a sustainability consultant would look at first,
// given THIS case's own result. It names levers, never numbers. Every item is
// triggered by something in the data (a material's share, the step that draws
// the electricity, a factor that is only an industry average) and says which
// flow or step it acts on, so a student can go and change exactly that.
//
// The moves are established practice, stated qualitatively (recycled
// aluminum needs far less energy than primary; electric-arc steel from scrap
// is lower-carbon than blast-furnace steel; a supplier EPD replaces a global
// average). No percentages are claimed here: the case's own numbers come from
// the engine, and a what-if is proven by duplicating the case and running it.

export interface ConsultantFlow {
  /** Substance name, e.g. "Aluminum", "Electricity". */
  name: string
  /** Impact in the active category. */
  value: number
  /** Step the flow sits on. */
  step: string
  /** Factor source tier: authoritative | industry_average | unverified | unknown. */
  tier?: string | null
}

export interface ConsultantItem {
  /** What to look at, e.g. "Aluminum is the lever". */
  title: string
  /** Why, grounded in this case (names the share, steps, or source). */
  why: string
  /** Concrete moves, most effective first. */
  moves: string[]
}

interface Playbook {
  match: RegExp
  kind: 'material' | 'energy' | 'transport' | 'packaging' | 'coating'
  moves: string[]
}

// Most specific first. Qualitative, widely accepted levers only.
const PLAYBOOKS: Playbook[] = [
  {
    match: /alumin/i,
    kind: 'material',
    moves: [
      'Ask the tube supplier for recycled-content or low-carbon alloy: recycled aluminum takes a small fraction of the energy of primary metal.',
      'If it must be primary, source metal smelted on hydro or other low-carbon power, and ask for its EPD.',
      'Take mass out: butted or thinner-wall tubing, fewer brackets and bosses.',
      'Test a material swap on a copy of the case (steel is the classic touring-frame alternative).',
    ],
  },
  {
    match: /stainless/i,
    kind: 'material',
    moves: [
      'Check whether a lower-alloy grade meets the corrosion need.',
      'Prefer suppliers melting from scrap in electric-arc furnaces, and ask for their EPD.',
    ],
  },
  {
    match: /steel|iron/i,
    kind: 'material',
    moves: [
      'Specify steel from electric-arc furnaces running on scrap, and ask for an EPD.',
      'Use lighter sections where strength allows.',
    ],
  },
  {
    match: /rubber|tire|tyre/i,
    kind: 'material',
    moves: [
      'Ask for recycled or bio-based compound content and the supplier EPD.',
      'Durability counts: a longer-lasting tire means fewer replacements over the bike’s life.',
    ],
  },
  {
    match: /plastic|polymer|abs|pvc|pet\b|hdpe|polypropylene/i,
    kind: 'material',
    moves: [
      'Use recycled-content polymer and a single material where possible, so the part can be recycled.',
    ],
  },
  {
    match: /cardboard|paper|corrugat|box/i,
    kind: 'packaging',
    moves: [
      'Right-size the box and cut void fill.',
      'Specify high recycled-content board, or reusable shipping packaging for dealer deliveries.',
    ],
  },
  {
    match: /epoxy|powder|coat|paint/i,
    kind: 'coating',
    moves: [
      'Keep powder reclaim running and hold film build to the specification, not above it.',
    ],
  },
  {
    match: /electric|power|kwh|grid/i,
    kind: 'energy',
    moves: [
      'Buy renewable electricity (a green tariff or power purchase agreement) or add on-site solar.',
    ],
  },
  {
    match: /transport|freight|truck|ocean|rail|air/i,
    kind: 'transport',
    moves: [
      'Consolidate shipments and keep freight on sea or rail rather than air.',
      'Weigh nearer suppliers against their own material footprint before switching.',
    ],
  },
]

// Step-specific energy moves, keyed on the step name.
const STEP_ENERGY_MOVES: Array<{ match: RegExp; moves: string[] }> = [
  { match: /cure|oven|bake/i, moves: ['Load the oven to full batches and cut warm-up cycles.', 'Check door seals and insulation; consider infrared or lower-temperature cure powders.'] },
  { match: /booth|spray|powder coat/i, moves: ['Run booth fans only while spraying, on a variable-speed drive.'] },
  { match: /weld/i, moves: ['Inverter welders and shorter idle time cut draw between arcs.'] },
  { match: /cut|saw|machin|mill|lathe/i, moves: ['Switch machines off between batches; check blade and tool condition.'] },
]

const pct = (x: number) => `${Math.round(x)}%`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "70. Final assembly" reads as "Final assembly (step 70)" inside a sentence. */
export function stepLabel(step: string): string {
  const m = step.match(/^\s*(\d+)\.\s+(.+)$/)
  return m ? `${m[2]} (step ${m[1]})` : step
}

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/**
 * Consultant read for one impact category of one run. `flows` are the run's
 * flow rows for that category; `leftOut` names lines excluded at import (e.g.
 * argon with no factor). Returns at most five items, most important first.
 */
export function consultantRead(
  flows: ConsultantFlow[],
  opts: { categoryLabel: string; leftOut?: string[] } = { categoryLabel: 'the result' },
): ConsultantItem[] {
  const positive = flows.filter((f) => f.value > 0)
  const total = positive.reduce((s, f) => s + f.value, 0)
  if (!(total > 0)) return []

  // Group by substance.
  const bySub = new Map<string, { value: number; steps: Set<string>; tiers: Set<string> }>()
  for (const f of positive) {
    const e = bySub.get(f.name) ?? { value: 0, steps: new Set<string>(), tiers: new Set<string>() }
    e.value += f.value
    e.steps.add(f.step)
    if (f.tier) e.tiers.add(f.tier)
    bySub.set(f.name, e)
  }
  const subs = [...bySub.entries()]
    .map(([name, e]) => ({ name, share: (e.value / total) * 100, steps: [...e.steps], tiers: [...e.tiers] }))
    .sort((a, b) => b.share - a.share)

  const items: ConsultantItem[] = []
  const used = new Set<string>()

  // 1. The dominant material or carrier.
  for (const s of subs.slice(0, 3)) {
    if (s.share < 10 && items.length > 0) break
    const book = PLAYBOOKS.find((b) => b.match.test(s.name))
    if (!book || used.has(book.kind + book.match.source)) continue
    used.add(book.kind + book.match.source)
    if (book.kind === 'energy') continue // handled with its steps below
    const where = s.steps.length === 1 ? `on ${stepLabel(s.steps[0])}` : `across ${plural(s.steps.length, 'step', 'steps')}`
    items.push({
      title: `${s.name} is ${items.length === 0 ? 'the biggest lever' : 'the next lever'}`,
      why: `${pct(s.share)} of ${opts.categoryLabel}, ${where}.`,
      moves: book.moves,
    })
  }

  // 2. Electricity: which step draws it, with that step's own moves.
  const elec = subs.find((s) => /electric/i.test(s.name))
  if (elec) {
    const byStep = new Map<string, number>()
    for (const f of positive.filter((f) => /electric/i.test(f.name))) byStep.set(f.step, (byStep.get(f.step) ?? 0) + f.value)
    const topSteps = [...byStep.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => s)
    const stepMoves = topSteps.flatMap((st) => STEP_ENERGY_MOVES.find((m) => m.match.test(st))?.moves ?? [])
    items.push({
      title: `Shop electricity: start with ${listOf(topSteps.map(stepLabel))}`,
      why: `Electricity is ${pct(elec.share)} of ${opts.categoryLabel}; ${topSteps.length === 1 ? 'that step draws' : 'those steps draw'} the most.${elec.share < 5 ? ' Small next to the materials, so it is not where to start.' : ''}`,
      moves: [...stepMoves, ...(PLAYBOOKS.find((b) => b.kind === 'energy')?.moves ?? [])],
    })
  }

  // 3. Data quality: the top items rest on averages, so a supplier EPD can
  //    move the number more than a design change.
  const avg = subs.slice(0, 3).filter((s) => s.tiers.length && s.tiers.every((t) => t === 'industry_average' || t === 'unverified' || t === 'unknown'))
  if (avg.length) {
    const names = avg.map((s) => s.name.toLowerCase())
    items.push({
      title: 'Replace averages with supplier data',
      why:
        avg.length === 1
          ? `${cap(names[0])} uses an industry-average factor, not your supplier's own figure.`
          : `${cap(listOf(names))} use industry-average factors, not your suppliers' own figures.`,
      moves: [
        `Request product-specific EPDs from the ${listOf(names)} ${avg.length === 1 ? 'supplier' : 'suppliers'}: a supplier's own figure can sit well above or below the average.`,
      ],
    })
  }

  // 4. What was left out.
  if (opts.leftOut?.length) {
    items.push({
      title: 'Close the gaps before comparing',
      why: `${opts.leftOut.join(', ')} ${opts.leftOut.length === 1 ? 'is' : 'are'} not in the result (no factor in the library).`,
      moves: ['Pick a documented proxy or state the exclusion in the goal and scope, so a comparison stays fair.'],
    })
  }

  return items.slice(0, 5)
}
