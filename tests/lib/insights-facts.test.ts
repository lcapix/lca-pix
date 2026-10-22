import { describe, it, expect } from 'vitest';
import { sanitizeInsightFacts, INSIGHT_LIMITS, buildInsightMessages } from '@/lib/insights/prompt';

const BASE = {
  caseName: 'Bracket',
  method: 'CML 2001',
  categoryLabel: 'Global Warming',
  total: { value: 10, unit: 'kg CO2 eq' },
  contributors: [{ name: 'Paint', pct: 60, value: 6 }],
  mode: 'summary',
};

describe('sanitizeInsightFacts (INS-2)', () => {
  it('accepts a normal payload unchanged', () => {
    const r = sanitizeInsightFacts(BASE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.facts).toMatchObject(BASE);
  });

  it(`rejects a question longer than ${INSIGHT_LIMITS.question} characters`, () => {
    const r = sanitizeInsightFacts({ ...BASE, mode: 'custom', question: 'x'.repeat(501) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/500/);
    expect(sanitizeInsightFacts({ ...BASE, mode: 'custom', question: 'x'.repeat(500) }).ok).toBe(true);
  });

  it('caps the contributor list and other arrays', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ name: `step ${i}`, pct: 0.1, value: 1 }));
    const r = sanitizeInsightFacts({ ...BASE, contributors: many, materials: many, allCategories: many.map((m) => ({ name: m.name, value: 1, unit: 'kg' })) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.facts.contributors.length).toBe(INSIGHT_LIMITS.contributors);
    expect(r.facts.materials!.length).toBeLessThanOrEqual(INSIGHT_LIMITS.contributors);
    expect(r.facts.allCategories!.length).toBeLessThanOrEqual(INSIGHT_LIMITS.categories);
    const lines = buildInsightMessages(r.facts).user.split('\n').filter((l) => l.startsWith('  - step'));
    expect(lines.length).toBeLessThanOrEqual(INSIGHT_LIMITS.contributors * 2 + INSIGHT_LIMITS.categories);
  });

  it('truncates long names so they cannot smuggle a second prompt', () => {
    const r = sanitizeInsightFacts({ ...BASE, caseName: 'n'.repeat(5000) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.facts.caseName.length).toBeLessThanOrEqual(INSIGHT_LIMITS.text);
  });

  it('rejects wrong types and unknown modes', () => {
    expect(sanitizeInsightFacts(null).ok).toBe(false);
    expect(sanitizeInsightFacts([]).ok).toBe(false);
    expect(sanitizeInsightFacts({ ...BASE, mode: 'jailbreak' }).ok).toBe(false);
    expect(sanitizeInsightFacts({ ...BASE, contributors: 'lots' }).ok).toBe(false);
    expect(sanitizeInsightFacts({ ...BASE, contributors: [{ name: 'a', pct: 'x', value: 1 }] }).ok).toBe(false);
    expect(sanitizeInsightFacts({ ...BASE, question: 42, mode: 'custom' }).ok).toBe(false);
  });
});
