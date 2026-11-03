/**
 * UX 4: the tier a new step is given, suggested from its parent. The steps
 * already under that parent say how this tree is built (a routing often puts
 * its operations straight under the line, skipping subprocess), so the tier
 * most of them have is the suggestion; with none yet, the tier just below
 * the parent. It comes with one line saying why. Pure.
 */

import { TIER_LABEL, TIERS, type Tier } from './tier-layout'

export interface TierSuggestion {
  tier: Tier
  why: string
}

export function suggestTier(parent: { id: number; name: string; tier: Tier }, steps: { parentId: number | null; tier: Tier }[]): TierSuggestion | null {
  const rank = TIERS.indexOf(parent.tier)
  const below = TIERS.slice(rank + 1)
  if (!below.length) return null
  const counts = new Map<Tier, number>()
  for (const s of steps) if (s.parentId === parent.id && below.includes(s.tier)) counts.set(s.tier, (counts.get(s.tier) ?? 0) + 1)
  if (counts.size) {
    // The most used; a tie goes to the higher tier, the smaller skip.
    const [tier, n] = [...counts.entries()].sort((a, b) => b[1] - a[1] || TIERS.indexOf(a[0]) - TIERS.indexOf(b[0]))[0]
    return { tier, why: `Like the ${n === 1 ? 'step' : `${n} steps`} already under ${parent.name}.` }
  }
  return { tier: below[0], why: `The tier just below ${TIER_LABEL[parent.tier].toLowerCase()}.` }
}
