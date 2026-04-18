// lib/integrations/pubchem/client.ts — thin client over PubChem PUG REST
// Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
// Free, no key. Rate limit ~5 req/s.

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const PROPS = 'MolecularFormula,MolecularWeight,IUPACName';

export interface PubChemCompound {
  cid: number;
  name: string;
  molecularFormula: string | null;
  molecularWeight: number | null;
  iupacName: string | null;
}

export async function fetchCompoundByName(name: string): Promise<PubChemCompound | null> {
  const encoded = encodeURIComponent(name);
  const url = `${BASE}/compound/name/${encoded}/property/${PROPS}/JSON`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`PubChem error ${res.status} for "${name}"`);
  }

  const body = await res.json();
  const p = body?.PropertyTable?.Properties?.[0];
  if (!p) return null;

  return {
    cid: p.CID,
    name,
    molecularFormula: p.MolecularFormula ?? null,
    molecularWeight: p.MolecularWeight ? parseFloat(p.MolecularWeight) : null,
    iupacName: p.IUPACName ?? null,
  };
}
