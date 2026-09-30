import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchSubstance, importFactorMethod } from '@/lib/integrations/openlca/import';
import * as dbHelpers from '@/lib/db-helpers';

vi.mock('@/lib/db-helpers');

describe('matchSubstance', () => {
  beforeEach(() => vi.resetAllMocks());

  it('matches by exact CAS number first', async () => {
    vi.mocked(dbHelpers.queryOne).mockResolvedValueOnce({ substance_id: 7 } as any);
    const id = await matchSubstance({
      substanceName: 'Methane', basis: 'elementary' as const, casNumber: '74-82-8', aliases: [], factors: [],
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
      substanceName: 'Methane', basis: 'elementary' as const, casNumber: '74-82-8', aliases: [], factors: [],
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
      substanceName: 'Methane', basis: 'elementary' as const, casNumber: null, aliases: ['CH4'], factors: [],
    });
    expect(id).toBe(99);
  });

  it('returns null if nothing matches', async () => {
    vi.mocked(dbHelpers.queryOne).mockResolvedValue(null);
    vi.mocked(dbHelpers.query).mockResolvedValue([]);
    const id = await matchSubstance({
      substanceName: 'NotAThing', basis: 'embodied' as const, casNumber: null, aliases: [], factors: [],
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
        substanceName: 'CO2', basis: 'elementary' as const, casNumber: '124-38-9', aliases: [],
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
      { substanceName: 'CO2', basis: 'embodied' as const, casNumber: null, aliases: [], factors: [
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
      { substanceName: 'Unknown', basis: 'embodied' as const, casNumber: null, aliases: [], factors: [
        { impactCategory: 'Global Warming', value: 1.0, unit: 'x' },
      ]},
    ]);
    expect(result.substancesMatched).toBe(0);
    expect(result.skippedNoSubstance).toBe(1);
    expect(result.inserted).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe('importFactorMethod never undoes the factor audit (E2)', () => {
  beforeEach(() => vi.resetAllMocks());

  const CO2 = {
    substanceName: 'CO2', basis: 'elementary' as const, casNumber: '124-38-9', aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 1.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.08, unit: 'kg C2H4 eq' },
    ],
  };

  // Dispatch by SQL so the test does not depend on call order.
  function stubDb(existing: Array<{ substance_id: number; category_id: number; method_name: string; geographic_scope?: string }>) {
    vi.mocked(dbHelpers.query).mockImplementation(async (sql: string) => {
      if (/FROM impact_categories/.test(sql)) {
        return [
          { category_id: 1, category_name: 'Global Warming' },
          { category_id: 6, category_name: 'Photochemical Oxidation' },
        ] as any;
      }
      if (/FROM driver_impact_factors/.test(sql)) {
        return existing.map((r) => ({ geographic_scope: 'Global', ...r })) as any;
      }
      return [] as any;
    });
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({ substance_id: 5 } as any);
    return vi.mocked(dbHelpers.insert).mockResolvedValue(1);
  }

  it('skips a (substance, category, method) that has a QUARANTINE twin', async () => {
    const insertSpy = stubDb([{ substance_id: 5, category_id: 6, method_name: 'QUARANTINE: TRACI 2.1' }]);

    const result = await importFactorMethod('TRACI 2.1', [CO2]);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy.mock.calls[0][1]).toEqual(expect.arrayContaining([5, 1, 'TRACI 2.1']));
    expect(insertSpy.mock.calls.some(([, p]) => (p as any[]).includes(6))).toBe(false);
    expect(result.inserted).toBe(1);
    expect(result.skippedQuarantined).toBe(1);
  });

  it('never updates a row that already exists (audited values stay put)', async () => {
    const insertSpy = stubDb([{ substance_id: 5, category_id: 1, method_name: 'CML 2001' }]);

    const result = await importFactorMethod('CML 2001', [CO2]);

    expect(result.skippedExisting).toBe(1);
    expect(result.inserted).toBe(1);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy.mock.calls[0][1]).toEqual(expect.arrayContaining([5, 6, 'CML 2001']));
  });

  it('writes insert-only SQL (no ON DUPLICATE KEY UPDATE)', async () => {
    const insertSpy = stubDb([]);
    await importFactorMethod('CML 2001', [CO2]);
    expect(insertSpy).toHaveBeenCalledTimes(2);
    for (const [sql] of insertSpy.mock.calls) {
      expect(sql).not.toMatch(/ON DUPLICATE KEY UPDATE/i);
    }
  });

  it('looks up both the live method and its QUARANTINE twin', async () => {
    stubDb([]);
    await importFactorMethod('TRACI 2.1', [CO2]);
    const call = vi.mocked(dbHelpers.query).mock.calls.find(([sql]) => /FROM driver_impact_factors/.test(sql));
    expect(call).toBeTruthy();
    expect(call![1]).toEqual(expect.arrayContaining(['TRACI 2.1', 'QUARANTINE: TRACI 2.1']));
  });

  it.each(['QUARANTINE: TRACI 2.1', 'constructor', 'IPCC 2021'])('rejects unsupported method %s', async (m) => {
    const insertSpy = stubDb([]);
    await expect(importFactorMethod(m, [CO2])).rejects.toThrow(/not supported/);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
