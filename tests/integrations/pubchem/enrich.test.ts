import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichSubstance } from '@/lib/integrations/pubchem/enrich';
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
