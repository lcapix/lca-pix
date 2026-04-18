import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCompoundByName } from '@/lib/integrations/pubchem/client';

describe('fetchCompoundByName', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { global.fetch = originalFetch; });

  it('returns structured data for a known compound', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        PropertyTable: {
          Properties: [{
            CID: 297,
            MolecularFormula: 'CH4',
            MolecularWeight: '16.04',
            IUPACName: 'methane',
          }],
        },
      }),
    } as Response);

    const result = await fetchCompoundByName('methane');
    expect(result).toEqual({
      cid: 297,
      name: 'methane',
      molecularFormula: 'CH4',
      molecularWeight: 16.04,
      iupacName: 'methane',
    });
  });

  it('returns null when PubChem returns 404', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false, status: 404, json: async () => ({}),
    } as Response);
    const result = await fetchCompoundByName('nonexistent-compound');
    expect(result).toBeNull();
  });

  it('throws on non-404 errors', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({}),
    } as Response);
    await expect(fetchCompoundByName('x')).rejects.toThrow(/500/);
  });

  it('URL-encodes the name', async () => {
    const fetchMock = vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ PropertyTable: { Properties: [] } }),
    } as Response);
    await fetchCompoundByName('carbon dioxide');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('carbon%20dioxide');
  });
});
