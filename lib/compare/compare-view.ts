// What Compare (E09, E09b) says, from GET /api/projects/[projectId]/compare.
// Pure, so every sentence and number a reader compares is tested. The rule
// for when numbers are compared at all is lib/compare/comparability.ts.

import { amountBox, fixed, result3, sig3, sig3n } from '@/lib/ui/format'
import type { Comparability, ComparabilityCheck } from './comparability'
import type { CaseDiff, FlowChange, FlowSide } from './diff'

export const LETTERS = 'ABCDEFGH'

/** "10. Cut blank" → { num: '10', label: 'Cut blank' }; a name with no number keeps it whole. */
export function stepParts(name: string): { num: string | null; label: string } {
  const m = /^(\d+)[.)]?\s+(.+)$/.exec(name.trim())
  return m ? { num: m[1], label: m[2] } : { num: null, label: name.trim() }
}

/** "Global Warming" → "Global warming". */
export function sentenceCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s
}

/** "1 painted steel bracket" → "painted steel bracket"; "2 mugs" stays; nothing → "functional unit". */
export function perNoun(fu: string | null | undefined): string {
  const t = (fu ?? '').trim()
  if (!t) return 'functional unit'
  const m = /^1\s+(.+)$/.exec(t)
  return m ? m[1] : t
}

/** "Base case vs Shorter cure cycle · TRACI 2.1 · US": the method and region only when every run agrees. */
export function headerLine(names: string[], c: Comparability): string {
  const parts = [names.join(' vs ')]
  const method = c.checks.find((k) => k.key === 'method')
  const region = c.checks.find((k) => k.key === 'region')
  if (method?.ok && method.detail !== '–') parts.push(method.detail)
  if (region?.ok && region.detail !== '–') parts.push(region.detail)
  return parts.filter(Boolean).join(' · ')
}

export function verdict(c: Comparability, cases: number): { ok: boolean; title: string; sub: string } {
  if (cases < 2) return { ok: false, title: 'Add a second case', sub: 'Compare puts two or more cases side by side' }
  // A region difference fails like any other check: no percentage across regions.
  if (!c.failed) return { ok: true, title: 'Fair to compare', sub: 'All four checks pass' }
  return { ok: false, title: 'Not comparable yet', sub: `${c.failed} of 4 checks ${c.failed === 1 ? 'fails' : 'fail'}` }
}

/** The check's own label when it passes, plus "Both runs current" for more than two cases. */
export function checkLabel(k: ComparabilityCheck, cases: number): string {
  if (k.key === 'current' && k.ok && cases > 2) return 'Every run current'
  return k.label
}

export interface CheckAction {
  caseId: string
  label: string
}

/**
 * What to do about a failed check: run a case it names again, under A's
 * method and region (the run route takes both), so the rerun passes the
 * check. A method or region check names the cases whose run differs from A
 * (lib/compare/comparability.ts), so the action never reruns A itself. The
 * label says which case and which method or region, and what it is on now
 * when `scopeOf` knows it. A functional unit set at the project is read at
 * run time, so a rerun fixes that check too once the unit is set.
 */
export function checkAction(
  k: ComparabilityCheck,
  nameOf: (id: string) => string,
  base: { method: string | null; region: string | null },
  scopeOf?: (id: string) => { method: string | null; region: string | null } | null,
): CheckAction | null {
  if (k.ok || !k.caseIds.length) return null
  const id = k.caseIds[0]
  const name = nameOf(id)
  const now = scopeOf?.(id) ?? null
  if (k.key === 'region' && base.region) {
    return { caseId: id, label: `Run ${name} again in ${base.region}${now?.region ? ` (it is in ${now.region})` : ''}` }
  }
  if (k.key === 'method' && base.method) {
    return { caseId: id, label: `Run ${name} again under ${base.method}${now?.method ? ` (it is on ${now.method})` : ''}` }
  }
  if (k.key === 'current' && /no run/.test(k.label)) return { caseId: id, label: `Run ${name}` }
  return { caseId: id, label: `Run ${name} again` }
}

type StepFlow = { step: string; substance: string; dir: 'input' | 'output'; quantity: number | null; unit: string }

// As the amount boxes show it: 0.80, 0.25, 0.0013 (the design writes "0.40 → 0.25 kWh").
const qty = (x: number | null) => (x === null ? 'no amount' : amountBox(x))
const side = (f: { quantity: number | null; unit: string }) => (f.quantity === null ? 'no amount' : `${qty(f.quantity)} ${f.unit}`.trim())

/** The line under a step: "Steel 0.8 kg · Electricity 0.05 kWh", at most three, then "+2 more". */
export function stepLine(flows: StepFlow[], showAmounts: boolean): string {
  const shown = flows.slice(0, 3).map((f) => `${f.substance}${showAmounts ? ` ${side(f)}` : ''}${f.dir === 'output' ? ' out' : ''}`)
  return [...shown, flows.length > 3 ? `+${flows.length - 3} more` : ''].filter(Boolean).join(' · ')
}

/** A changed flow at a step, the way the row and the panel say it: "Electricity 0.4 → 0.25 kWh". */
export function changeText(c: FlowChange): string {
  const sameUnit = (a: FlowSide, b: FlowSide) => a.unit === b.unit
  switch (c.kind) {
    case 'changed':
      return sameUnit(c.from, c.to)
        ? `${c.to.substance} ${qty(c.from.quantity)} → ${qty(c.to.quantity)} ${c.to.unit}`.trim()
        : `${c.to.substance} ${side(c.from)} → ${side(c.to)}`
    case 'swapped':
      return `${c.from.substance} → ${c.to.substance}`
    case 'added':
      return `Added ${c.to.substance} ${side(c.to)}`
    case 'removed':
      return `Removed ${c.from.substance}`
    case 'factor':
      return `${c.flow.substance}: ${c.to ? 'own factor' : 'library factor'}`
  }
}

export interface StepRow {
  step: string
  num: string | null
  label: string
  line: string
  values: number[]
  /** Change of the last case against the first (the base). */
  delta: number
  changed: boolean
}

/**
 * Change by step: every step that has a result or a flow in any case, in the
 * order the steps are numbered, with each case's value and the change of
 * the second case against the base. A step counts as changed when its value
 * moved or the inventory diff names it.
 */
export function stepRows(
  cases: Array<{ byStep: Array<{ step: string; category: string; value: number }>; stepFlows?: StepFlow[] }>,
  category: string,
  diff: CaseDiff | null,
  showAmounts: boolean,
): StepRow[] {
  const names = new Set<string>()
  for (const c of cases) {
    for (const s of c.byStep) if (s.category === category) names.add(s.step)
    for (const f of c.stepFlows ?? []) if (f.step) names.add(f.step)
  }
  const valueOf = (c: (typeof cases)[number], step: string) =>
    c.byStep.filter((s) => s.category === category && s.step === step).reduce((t, s) => t + s.value, 0)
  const changedSteps = new Map<string, FlowChange[]>()
  for (const f of diff?.flows ?? []) changedSteps.set(f.step, [...(changedSteps.get(f.step) ?? []), f])
  const last = cases[cases.length - 1]
  const rows = [...names].map((step) => {
    const values = cases.map((c) => valueOf(c, step))
    const delta = values[values.length - 1] - values[0]
    const tol = Math.max(Math.abs(values[0]), 1) * 1e-9
    const changes = changedSteps.get(step)
    const flows = (last.stepFlows ?? []).filter((f) => f.step === step)
    const { num, label } = stepParts(step)
    return {
      step,
      num,
      label,
      line: changes?.length ? changes.map(changeText).join(' · ') : stepLine(flows, showAmounts),
      values,
      delta,
      changed: Math.abs(delta) > tol || !!changes?.length,
    }
  })
  const order = (r: StepRow) => (r.num === null ? Number.POSITIVE_INFINITY : Number(r.num))
  return rows.sort((a, b) => order(a) - order(b) || a.step.localeCompare(b.step))
}

/** A value in the table: "1.538 kg CO₂-eq", "0 kg CO₂-eq". */
export function cellValue(v: number, unit: string): string {
  return `${v === 0 ? '0' : result3(v)} ${unit}`
}

/** The Change cell: "unchanged" or a signed "−0.053 kg CO₂-eq". */
export function changeCell(delta: number, unit: string, changed: boolean): string {
  if (!changed || sig3n(delta) === 0) return changed ? `±0 ${unit}` : 'unchanged'
  return `${delta < 0 ? '−' : '+'}${sig3(Math.abs(delta))} ${unit}`
}

/**
 * The change of `value` against `base` in percent of the size of the base,
 * from the run values (not the rounded totals): the one number Compare's
 * totals chip, its Ranking and its verdict all print for the same pair.
 * Null when the base is 0 or a value is missing.
 */
export function changePct(value: number | null | undefined, base: number | null | undefined): number | null {
  if (value === null || value === undefined || base === null || base === undefined) return null
  if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) return null
  return ((value - base) / Math.abs(base)) * 100
}

/** "11.0% lower than A", "the same as A" (within 0.1%), or null when there is no percentage. */
export function changeWords(value: number, base: number, against = 'A'): string | null {
  const pct = changePct(value, base)
  if (pct === null) return null
  const shown = fixed(Math.abs(pct), 1)
  if (shown === '0.0') return `the same as ${against}`
  return `${shown}% ${pct < 0 ? 'lower' : 'higher'} than ${against}`
}

/** "▼ 11.0% lower" against the base, the same percentage as the Ranking and the verdict. */
export function totalChip(value: number, base: number): string | null {
  const pct = changePct(value, base)
  if (pct === null) return null
  const shown = fixed(Math.abs(pct), 1)
  if (shown === '0.0') return 'Same as A'
  return `${pct < 0 ? '▼' : '▲'} ${shown}% ${pct < 0 ? 'lower' : 'higher'}`
}

export interface WhatChanged {
  /** The first change, told in full. */
  main: { from: string; to: string; unit: string; where: string; substance: string } | null
  /** Every change, one line each ("Electricity 0.4 → 0.25 kWh at 30. Powder coat and cure"). */
  lines: string[]
  /** The changed flow's factor in this category: its result over its amount, in B's run. */
  factor: { value: number; unit: string; scope: string | null; tier: string | null } | null
  nothingElse: boolean
}

/** One line per setting the two runs differ in: "Region (electricity grid): US → EU". */
export function scopeLines(scope: ReadonlyArray<{ label: string; base: string; other: string }> | null | undefined): string[] {
  return (scope ?? []).map((d) => {
    const line = `${d.label}: ${d.base} → ${d.other}`
    if (/^region/i.test(d.label)) return `${line}. The electricity factor changes with the region.`
    if (/method/i.test(d.label)) return `${line}. Every factor comes from the other method.`
    return line
  })
}

type ResultFlow = { step: string; substance: string; category: string; value: number }

/**
 * Flows the inventory did not change whose result moved between the two runs
 * in this category: the factor behind them changed (another region's grid,
 * another method, or an own factor). Values are the runs' own, per
 * functional unit.
 */
export function factorShifts(
  diff: CaseDiff | null,
  a: { flows: ResultFlow[] },
  b: { flows: ResultFlow[] },
  category: string,
  unit: string,
): string[] {
  const key = (f: { step: string; substance: string }) => `${f.step}\u0000${f.substance}`
  const sum = (rows: ResultFlow[]) => {
    const m = new Map<string, { step: string; substance: string; value: number }>()
    for (const r of rows) {
      if (r.category !== category) continue
      const had = m.get(key(r))
      m.set(key(r), { step: r.step, substance: r.substance, value: (had?.value ?? 0) + r.value })
    }
    return m
  }
  const touched = new Set<string>()
  for (const f of diff?.flows ?? []) {
    if (f.kind === 'changed' || f.kind === 'swapped') touched.add(key({ step: f.step, substance: f.to.substance })).add(key({ step: f.step, substance: f.from.substance }))
    else if (f.kind === 'added') touched.add(key({ step: f.step, substance: f.to.substance }))
    else if (f.kind === 'removed') touched.add(key({ step: f.step, substance: f.from.substance }))
  }
  const ma = sum(a.flows)
  const mb = sum(b.flows)
  const lines: string[] = []
  for (const [k, x] of ma) {
    const y = mb.get(k)
    if (!y || touched.has(k)) continue
    if (sig3n(x.value) === sig3n(y.value)) continue
    lines.push(`${x.substance} at ${x.step}: same amount, but its result went ${result3(x.value)} → ${result3(y.value)} ${unit}, so its factor changed`)
  }
  // Own factors the inventory diff already names are not repeated.
  return lines.filter((l) => !(diff?.flows ?? []).some((f) => f.kind === 'factor' && l.startsWith(`${f.flow.substance} at ${f.step}:`)))
}

/**
 * What changed between A and B, from the inventory diff (lib/compare/diff.ts),
 * the settings the two runs differ in (method, region, functional unit) and
 * any factor that moved under an unchanged flow, plus B's own run: the factor
 * is B's result for that flow divided by its amount, so it is the number the
 * run used, not a library lookup.
 */
export function whatChanged(
  diff: CaseDiff | null,
  other: { flows: Array<{ step: string; substance: string; category: string; value: number; tier?: string | null; scope?: string | null }> },
  category: string,
  unit: string,
  extra: { scope?: ReadonlyArray<{ label: string; base: string; other: string }>; base?: { flows: ResultFlow[] } } = {},
): WhatChanged {
  const settings = scopeLines(extra.scope)
  const shifts = extra.base ? factorShifts(diff, extra.base, other, category, unit) : []
  if (!diff && !settings.length && !shifts.length) return { main: null, lines: [], factor: null, nothingElse: false }
  const lines = [
    ...settings,
    ...(diff?.flows ?? []).map((f) => `${changeText(f)} at ${f.step}`),
    ...(diff?.steps ?? []).map((s) => `${s.kind === 'added' ? 'Added' : 'Removed'} the step ${s.step}`),
    ...(diff?.costs ?? []).map((c) => `${sentenceCase(c.kind)} cost at ${c.step}: ${fixed(c.from, 2)} → ${fixed(c.to, 2)}`),
    ...(diff?.hours ?? []).map((h) => `Hours at ${h.step}: ${h.from ?? 'none'} → ${h.to ?? 'none'}`),
    ...shifts,
  ]
  // The headline change is a flow edit only when no setting changed: a method or
  // region difference is the bigger change, and it leads.
  const first = settings.length ? undefined : ((diff?.flows ?? []).find((f) => f.kind === 'changed') as Extract<FlowChange, { kind: 'changed' }> | undefined)
  let factor: WhatChanged['factor'] = null
  if (first && first.to.quantity) {
    const rows = other.flows.filter((r) => r.step === first.step && r.substance === first.to.substance && r.category === category)
    if (rows.length === 1) {
      factor = { value: rows[0].value / first.to.quantity, unit: `${unit}/${first.to.unit}`, scope: rows[0].scope ?? null, tier: rows[0].tier ?? null }
    }
  }
  return {
    main: first ? { from: qty(first.from.quantity), to: qty(first.to.quantity), unit: first.to.unit, where: first.step, substance: first.to.substance } : null,
    lines,
    factor,
    nothingElse: lines.length === 1,
  }
}

/** "0.053 kg less, all from 30. Powder coat and cure." from the step rows. */
export function changeSummary(rows: StepRow[], unit: string): string | null {
  const moved = rows.filter((r) => sig3n(r.delta) !== 0)
  if (!moved.length) return null
  const total = moved.reduce((t, r) => t + r.delta, 0)
  if (sig3n(total) === 0) return 'The changes cancel out.'
  const word = total < 0 ? 'less' : 'more'
  const short = unit.split(' ')[0] || unit
  const head = `${sig3(Math.abs(total))} ${short} ${word}`
  if (moved.length === 1) return `${head}, all from ${moved[0].step}.`
  const top = [...moved].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
  // A share of the net change only reads right when every step moved the same way.
  if (moved.every((r) => Math.sign(r.delta) === Math.sign(total))) {
    return `${head}, most from ${top.step} (${fixed((Math.abs(top.delta) / Math.abs(total)) * 100, 0)}%).`
  }
  return `${head} in all. The largest change is at ${top.step}.`
}
