import { describe, it, expect } from 'vitest';
import { calculateOverallRankings } from '@/lib/comparison-engine';
import type { CaseImpact, CategoryComparison } from '@/lib/comparison-engine';

// Two cases, two categories. Case A wins Resource Depletion (tiny numbers);
// case B wins Global Warming (huge numbers). Under the old raw-sum ranking,
// B's GW magnitude drowned everything and B always "won overall" — even when
// A wins just as many categories.
const cases: CaseImpact[] = [
  {
    case_id: 1,
    case_name: 'A',
    total_impacts: [
      { category_id: 1, category_name: 'Global Warming', impact_value: 1000, unit: 'kg CO2 eq' },
      { category_id: 8, category_name: 'Resource Depletion', impact_value: 0.1, unit: 'kg Sb eq' },
    ],
  } as any,
  {
    case_id: 2,
    case_name: 'B',
    total_impacts: [
      { category_id: 1, category_name: 'Global Warming', impact_value: 900, unit: 'kg CO2 eq' },
      { category_id: 8, category_name: 'Resource Depletion', impact_value: 0.9, unit: 'kg Sb eq' },
    ],
  } as any,
];

const categoryComparisons: CategoryComparison[] = [
  {
    category_id: 1,
    category_name: 'Global Warming',
    unit: 'kg CO2 eq',
    best_case_id: 2,
    worst_case_id: 1,
    variance: 0,
    values: [
      { case_id: 1, case_name: 'A', absolute_value: 1000, delta_from_base: 0, delta_percentage: 0, rank: 2 },
      { case_id: 2, case_name: 'B', absolute_value: 900, delta_from_base: -100, delta_percentage: -10, rank: 1 },
    ],
  } as any,
  {
    category_id: 8,
    category_name: 'Resource Depletion',
    unit: 'kg Sb eq',
    best_case_id: 1,
    worst_case_id: 2,
    variance: 0,
    values: [
      { case_id: 1, case_name: 'A', absolute_value: 0.1, delta_from_base: 0, delta_percentage: 0, rank: 1 },
      { case_id: 2, case_name: 'B', absolute_value: 0.9, delta_from_base: 0.8, delta_percentage: 800, rank: 2 },
    ],
  } as any,
];

describe('overall comparison ranking (unit-safe)', () => {
  it('ranks by mean category rank, never by the cross-unit sum', () => {
    const rankings = calculateOverallRankings(cases, categoryComparisons);
    // Both cases win one category each → identical mean rank (1.5), identical
    // wins/losses → a genuine tie, resolved deterministically, NOT by GW size.
    expect(rankings[0].mean_category_rank).toBeCloseTo(1.5, 9);
    expect(rankings[1].mean_category_rank).toBeCloseTo(1.5, 9);
    // The raw sum is still exposed for display but must not decide order:
    // if it did, B (sum 900.9 < A's 1000.1) would ALWAYS be rank 1 with a
    // 100 score and A would get 0. With mean-rank scoring both sit mid-scale.
    expect(rankings[0].normalized_score).toBeCloseTo(50, 6);
    expect(rankings[1].normalized_score).toBeCloseTo(50, 6);
  });

  it('a case that wins every category ranks first regardless of magnitudes', () => {
    const sweep: CategoryComparison[] = categoryComparisons.map(c => ({
      ...c,
      best_case_id: 1,
      worst_case_id: 2,
      values: c.values.map(v => ({ ...v, rank: v.case_id === 1 ? 1 : 2 })),
    }));
    const rankings = calculateOverallRankings(cases, sweep);
    expect(rankings[0].case_id).toBe(1);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].normalized_score).toBe(100);
    expect(rankings[1].normalized_score).toBe(0);
  });
});
