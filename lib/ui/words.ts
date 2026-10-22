/**
 * The words the screens use, exactly (design/education/specs/rules.md). A
 * component takes a kind and prints the word, so no screen can say "Industry
 * average" or invent a status.
 */

export type SourceKind = 'supplier' | 'regional' | 'global' | 'hand' | 'reference'
export const SOURCE_WORD: Record<SourceKind, string> = {
  supplier: 'Supplier',
  regional: 'Regional',
  global: 'Global average',
  hand: 'Entered by hand',
  reference: 'Reference',
}

export type FlowStatus = 'counted' | 'no_factor' | 'needs_amount' | 'left_out'
export const FLOW_STATUS_WORD: Record<FlowStatus, string> = {
  counted: 'Counted',
  no_factor: 'Counted, no climate factor',
  needs_amount: 'Needs an amount',
  left_out: "Left out, unit can't convert",
}

export type Access = 'editor' | 'viewer'
export const ACCESS_WORD: Record<Access, string> = { editor: 'Can change', viewer: 'Can read' }

export type FlagKind = 'soon' | 'dev' | 'beta' | 'sample'
export const FLAG_WORD: Record<FlagKind, string> = {
  soon: 'Coming soon',
  dev: 'In development',
  beta: 'Beta',
  sample: 'Sample',
}

/** "2 need an amount", "1 needs an amount" (tab badges, the tree). */
export function needAmountCount(n: number): string {
  return `${n} ${n === 1 ? 'needs' : 'need'} an amount`
}
