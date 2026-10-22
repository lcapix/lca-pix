/**
 * How a step's cost reads in the Cost panel (E14): "0.015 h × $25.83/h ·
 * Welders/cutters", its source tag ("Reference 2026-06", "BLS OEWS 2025 ·
 * live", "Entered by hand"), and the six kinds' names. Pure, so it is tested
 * without a browser.
 */

import { amount, fixed } from '@/lib/ui/format'
import type { CostBasis, CostBasisKind, CostLine } from '@/lib/costs/cost-basis'

export const COST_KIND_LABEL: Record<CostBasisKind, string> = {
  labor: 'Labor',
  energy: 'Energy',
  material: 'Material',
  transportation: 'Transport',
  equipment: 'Equipment',
  overhead: 'Overhead',
}

/** "$25.83/h"; a rate under a dollar keeps up to four places ("$0.0862/kWh", "$0.95/kg"). */
export function rateText(rate: number, unit: string | null | undefined): string {
  const r = Math.abs(rate) < 1 && rate !== 0 ? fixed(rate, 4).replace(/(\.\d\d\d*?)0+$/, '$1') : fixed(rate, 2)
  const per = String(unit ?? '').replace(/^\$\s*\/\s*/, '')
  return `$${r}${per ? `/${per}` : ''}`
}

/** "Steel 0.8 kg × $0.95/kg + Natural Gas 1.8 m3 × $0.28/m3": a cost built line by line. */
export function costLinesText(lines: CostLine[]): string {
  return lines.map((l) => `${l.label} ${amount(l.quantity)} ${l.unit} × ${rateText(l.rate, l.rate_unit)}`).join(' + ')
}

/** The basis as one line, or null when the amount stands alone. A cost built line by line shows its lines. */
export function basisLine(
  b: Pick<CostBasis, 'driver_quantity' | 'driver_unit' | 'rate' | 'rate_unit' | 'rate_label'> & {
    source_name?: string | null
    lines?: CostLine[] | null
  },
): string | null {
  if (b.driver_quantity === null || b.rate === null) return b.lines?.length ? costLinesText(b.lines) : (b.rate_label ?? b.source_name ?? null)
  const q = `${amount(b.driver_quantity)}${b.driver_unit ? ` ${b.driver_unit}` : ''}`
  return [`${q} × ${rateText(b.rate, b.rate_unit)}`, b.rate_label].filter(Boolean).join(' · ')
}

/**
 * The tag a cost carries: the class it is drawn with (ds-tag--*) and its words.
 * A reference rate shows its vintage; a live one its source name and "live";
 * a person's own number "Entered by hand".
 */
export function basisTag(b: Pick<CostBasis, 'source_kind' | 'source_name' | 'vintage'>): { kind: 'reference' | 'regional' | 'hand'; text: string } {
  if (b.source_kind === 'live') return { kind: 'regional', text: `${b.source_name ?? 'Live'} · live` }
  if (b.source_kind === 'reference') return { kind: 'reference', text: b.vintage ? `Reference ${b.vintage}` : 'Reference' }
  // The source name, when there is one, already reads on the line above the tag.
  return { kind: 'hand', text: 'Entered by hand' }
}

/** "4 of 6 set". */
export const setLine = (set: number, of: number) => `${set} of ${of} set`
