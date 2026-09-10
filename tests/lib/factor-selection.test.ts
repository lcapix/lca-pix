import { describe, it, expect } from 'vitest';
import { canonicalizeRegion, selectBestScopeRows } from '@/lib/factor-selection';

describe('canonicalizeRegion', () => {
  it('maps UI labels to canonical zone codes', () => {
    expect(canonicalizeRegion('US Grid')).toBe('US');
    expect(canonicalizeRegion('EU Average')).toBe('EU');
    expect(canonicalizeRegion('Global')).toBe('Global');
    expect(canonicalizeRegion('Global average')).toBe('Global');
  });

  it('defaults null/undefined/empty to Global', () => {
    expect(canonicalizeRegion(null)).toBe('Global');
    expect(canonicalizeRegion(undefined)).toBe('Global');
    expect(canonicalizeRegion('')).toBe('Global');
  });

  it('passes through existing zone codes untouched', () => {
    expect(canonicalizeRegion('DE')).toBe('DE');
    expect(canonicalizeRegion('US-CAL')).toBe('US-CAL');
  });

  it('is case-insensitive on known labels', () => {
    expect(canonicalizeRegion('us grid')).toBe('US');
    expect(canonicalizeRegion('EU AVERAGE')).toBe('EU');
  });
});

describe('selectBestScopeRows', () => {
  const row = (flow_id: number, category_id: number, geographic_scope: string, factor = 1) => ({
    flow_id,
    category_id,
    geographic_scope,
    factor,
  });

  it('keeps a single row when only Global exists (the fallback)', () => {
    const { selected, scopeUsed } = selectBestScopeRows([row(1, 1, 'Global')], 'US');
    expect(selected).toHaveLength(1);
    expect(scopeUsed.get('1:1')).toBe('Global');
  });

  it('prefers the exact-region row over Global — and never keeps both', () => {
    const { selected, scopeUsed } = selectBestScopeRows(
      [row(1, 1, 'Global', 0.5), row(1, 1, 'US', 0.38)],
      'US',
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].geographic_scope).toBe('US');
    expect(scopeUsed.get('1:1')).toBe('US');
  });

  it('prefers the exact-region row regardless of row order', () => {
    const { selected } = selectBestScopeRows(
      [row(1, 1, 'US', 0.38), row(1, 1, 'Global', 0.5)],
      'US',
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].geographic_scope).toBe('US');
  });

  it('dedupes independently per flow × category', () => {
    const { selected } = selectBestScopeRows(
      [
        row(1, 1, 'Global'),
        row(1, 1, 'US'),
        row(1, 2, 'Global'),
        row(2, 1, 'US'),
      ],
      'US',
    );
    // 3 distinct (flow, category) pairs survive from 4 rows
    expect(selected).toHaveLength(3);
    const keys = selected.map((r) => `${r.flow_id}:${r.category_id}:${r.geographic_scope}`);
    expect(keys).toContain('1:1:US');
    expect(keys).toContain('1:2:Global');
    expect(keys).toContain('2:1:US');
  });

  it('THE regression: duplicate zone+Global rows do not double the impact', () => {
    // 100 kg of a substance with factor 1.0 in both scopes must contribute
    // 100 — not 200 — to the category total.
    const rows = [
      { ...row(7, 1, 'Global'), quantity: 100, factor_value: 1.0 },
      { ...row(7, 1, 'US'), quantity: 100, factor_value: 1.0 },
    ];
    const { selected } = selectBestScopeRows(rows, 'US');
    const total = selected.reduce((s, r: any) => s + r.quantity * r.factor_value, 0);
    expect(total).toBe(100);
  });

  it('scope matching is case-insensitive', () => {
    const { selected } = selectBestScopeRows(
      [row(1, 1, 'global'), row(1, 1, 'us')],
      'US',
    );
    expect(selected[0].geographic_scope).toBe('us');
  });
});
