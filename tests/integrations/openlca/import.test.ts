import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchSubstance, importFactorMethod } from '@/lib/integrations/openlca/import';
import * as dbHelpers from '@/lib/db-helpers';

vi.mock('@/lib/db-helpers');

describe('matchSubstance', () => {
  beforeEach(() => vi.resetAllMocks());

  it('matches by exact CAS number first', async () => {
    vi.mocked(dbHelpers.queryOne).mockResolvedValueOnce({ substance_id: 7 } as any);
    const id = await matchSubstance({
      substanceName: 'Methane', casNumber: '74-82-8', aliases: [], factors: [],
    });
    expect(id).toBe(7);
    const sql = vi.mocked(dbHelpers.queryOne).mock.calls[0][0];
    expect(sql).toContain('cas_number = ?');
  });

  it('falls back to exact name match when CAS not found', async () => {
    vi.mocked(dbHelpers.queryOne)
      .mockResolvedValueOnce(null)          // no CAS match
      .mockResolvedValueOnce({ substance_id: 12 } as any);  // name match
    const id = await matchSubstance({
      substanceName: 'Methane', casNumber: '74-82-8', aliases: [], factors: [],
    });
    expect(id).toBe(12);
  });

  it('falls back to alias match (case-insensitive)', async () => {
    vi.mocked(dbHelpers.queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(dbHelpers.query).mockResolvedValueOnce([
      { substance_id: 99, substance_name: 'methane' },
    ] as any);
    const id = await matchSubstance({
      substanceName: 'Methane', casNumber: null, aliases: ['CH4'], factors: [],
    });
    expect(id).toBe(99);
  });

  it('returns null if nothing matches', async () => {
    vi.mocked(dbHelpers.queryOne).mockResolvedValue(null);
    vi.mocked(dbHelpers.query).mockResolvedValue([]);
    const id = await matchSubstance({
      substanceName: 'NotAThing', casNumber: null, aliases: [], factors: [],
    });
    expect(id).toBeNull();
  });
});

describe('importFactorMethod', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inserts factors with method_name and returns counts', async () => {
    // Stub impact_categories lookup (called once up-front)
    vi.mocked(dbHelpers.query).mockResolvedValue([
      { category_id: 1, category_name: 'Global Warming' },
      { category_id: 3, category_name: 'Acidification' },
    ] as any);
    // Stub substance matching: everything resolves to id=5
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({ substance_id: 5 } as any);
    // Stub insert
    const insertSpy = vi.mocked(dbHelpers.insert).mockResolvedValue(1);

    const result = await importFactorMethod('CML 2001', [
      {
        substanceName: 'CO2', casNumber: '124-38-9', aliases: [],
        factors: [
          { impactCategory: 'Global Warming', value: 1.0, unit: 'kg CO2 eq' },
          { impactCategory: 'Acidification', value: 0.0, unit: 'kg SO2 eq' },
        ],
      },
    ]);

    expect(result.inserted).toBe(2);
    expect(result.substancesMatched).toBe(1);
    expect(result.skippedNoCategory).toBe(0);
    expect(insertSpy).toHaveBeenCalledTimes(2);
    const firstInsertSql = insertSpy.mock.calls[0][0];
    expect(firstInsertSql).toContain('INSERT INTO driver_impact_factors');
    expect(firstInsertSql).toContain('method_name');
  });

  it('skips factors whose category is not in impact_categories', async () => {
    vi.mocked(dbHelpers.query).mockResolvedValue([
      { category_id: 1, category_name: 'Global Warming' },
    ] as any);
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({ substance_id: 5 } as any);
    const insertSpy = vi.mocked(dbHelpers.insert).mockResolvedValue(1);

    const result = await importFactorMethod('CML 2001', [
      { substanceName: 'CO2', casNumber: null, aliases: [], factors: [
        { impactCategory: 'Global Warming', value: 1.0, unit: 'x' },
        { impactCategory: 'Nonexistent', value: 1.0, unit: 'x' },
      ]},
    ]);
    expect(result.inserted).toBe(1);
    expect(result.skippedNoCategory).toBe(1);
  });

  it('increments skippedNoSubstance when no substance matches', async () => {
    // First call to query = impact_categories lookup
    // Subsequent call(s) to query = alias lookup inside matchSubstance
    vi.mocked(dbHelpers.query)
      .mockResolvedValueOnce([{ category_id: 1, category_name: 'Global Warming' }] as any)
      .mockResolvedValueOnce([] as any);  // alias lookup returns nothing
    vi.mocked(dbHelpers.queryOne).mockResolvedValue(null);   // no CAS / name match
    const insertSpy = vi.mocked(dbHelpers.insert).mockResolvedValue(1);

    const result = await importFactorMethod('CML 2001', [
      { substanceName: 'Unknown', casNumber: null, aliases: [], factors: [
        { impactCategory: 'Global Warming', value: 1.0, unit: 'x' },
      ]},
    ]);
    expect(result.substancesMatched).toBe(0);
    expect(result.skippedNoSubstance).toBe(1);
    expect(result.inserted).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
