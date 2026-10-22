import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichSubstance, enrichAllSubstances } from '@/lib/integrations/pubchem/enrich';
import * as client from '@/lib/integrations/pubchem/client';
import * as dbHelpers from '@/lib/db-helpers';

vi.mock('@/lib/integrations/pubchem/client');
vi.mock('@/lib/db-helpers');

describe('enrichSubstance', () => {
  beforeEach(() => vi.resetAllMocks());

  it('updates substance fields when PubChem returns data', async () => {
    vi.mocked(client.fetchCompoundByName).mockResolvedValue({
      cid: 297, name: 'methane',
      molecularFormula: 'CH4', molecularWeight: 16.04, iupacName: 'methane',
    });
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({
      substance_id: 5, substance_name: 'Methane',
    } as any);
    const executeSpy = vi.mocked(dbHelpers.execute).mockResolvedValue(1);

    const result = await enrichSubstance(5);

    expect(result).toEqual({ status: 'enriched', cid: 297 });
    expect(executeSpy).toHaveBeenCalledOnce();
    const [sql, params] = executeSpy.mock.calls[0];
    expect(sql).toContain('UPDATE substances');
    expect(params).toContain(297);          // pubchem_cid
    expect(params).toContain('CH4');        // formula
    expect(params).toContain(16.04);        // weight
  });

  it('marks as not_found when PubChem returns null but still stamps enriched_at', async () => {
    vi.mocked(client.fetchCompoundByName).mockResolvedValue(null);
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({
      substance_id: 9, substance_name: 'WeirdProprietaryChemical',
    } as any);
    const executeSpy = vi.mocked(dbHelpers.execute).mockResolvedValue(1);

    const result = await enrichSubstance(9);

    expect(result).toEqual({ status: 'not_found' });
    expect(executeSpy).toHaveBeenCalledOnce();
    const sql = executeSpy.mock.calls[0][0];
    expect(sql).toContain('enriched_at = NOW()');
  });

  it('throws when substance does not exist', async () => {
    vi.mocked(dbHelpers.queryOne).mockResolvedValue(null);
    await expect(enrichSubstance(999)).rejects.toThrow(/not found/);
  });
});

describe('enrichSubstance leaves custom substances alone (INT-4)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('does not call PubChem or update a custom (is_custom = 1) substance', async () => {
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({
      substance_id: 3001, substance_name: 'Supplier alloy X', is_custom: 1,
    } as any);
    const executeSpy = vi.mocked(dbHelpers.execute).mockResolvedValue(1);

    const result = await enrichSubstance(3001);

    expect(result.status).toBe('skipped_custom');
    expect(client.fetchCompoundByName).not.toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('guards the UPDATE itself with is_custom = 0', async () => {
    vi.mocked(client.fetchCompoundByName).mockResolvedValue({
      cid: 297, name: 'methane', molecularFormula: 'CH4', molecularWeight: 16.04, iupacName: 'methane',
    });
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({ substance_id: 5, substance_name: 'Methane', is_custom: 0 } as any);
    const executeSpy = vi.mocked(dbHelpers.execute).mockResolvedValue(1);

    await enrichSubstance(5);
    expect(executeSpy.mock.calls[0][0]).toMatch(/is_custom = 0/);
  });
});

describe('enrichAllSubstances (INT-4)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('processes at most 50 substances when no limit is given', async () => {
    vi.mocked(dbHelpers.query).mockResolvedValue([] as any);
    await enrichAllSubstances({ onlyMissing: true });
    const sql = vi.mocked(dbHelpers.query).mock.calls[0][0];
    expect(sql).toMatch(/LIMIT 50\b/);
  });

  it('caps the limit at 500', async () => {
    vi.mocked(dbHelpers.query).mockResolvedValue([] as any);
    await enrichAllSubstances({ limit: 100000 });
    expect(vi.mocked(dbHelpers.query).mock.calls[0][0]).toMatch(/LIMIT 500\b/);
  });

  it('falls back to the default for a non-integer limit', async () => {
    vi.mocked(dbHelpers.query).mockResolvedValue([] as any);
    await enrichAllSubstances({ limit: 'x' as any });
    expect(vi.mocked(dbHelpers.query).mock.calls[0][0]).toMatch(/LIMIT 50\b/);
  });

  it('only selects library substances, never custom ones', async () => {
    vi.mocked(dbHelpers.query).mockResolvedValue([] as any);
    await enrichAllSubstances({ onlyMissing: false });
    expect(vi.mocked(dbHelpers.query).mock.calls[0][0]).toMatch(/is_custom = 0/);
  });
});
