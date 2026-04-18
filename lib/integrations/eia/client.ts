// lib/integrations/eia/client.ts
// Docs: https://www.eia.gov/opendata/documentation.php
const BASE = 'https://api.eia.gov/v2';

export interface EnergyPrice {
  fuel: 'electricity' | 'natural_gas';
  state: string;
  rateValue: number;   // $/kWh or $/MCF
  unit: string;
  period: string;      // e.g. '2026-01'
}

function requireKey(): string {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error('EIA_API_KEY not configured — sign up at https://www.eia.gov/opendata/');
  return key;
}

/**
 * Fetch latest retail electricity price for a US state (cents/kWh → $/kWh).
 * sector: 'IND' industrial, 'COM' commercial, 'RES' residential, 'ALL' all sectors.
 */
export async function fetchElectricityPrice(state: string, sector = 'IND'): Promise<EnergyPrice | null> {
  const key = requireKey();
  const url = new URL(`${BASE}/electricity/retail-sales/data/`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('frequency', 'monthly');
  url.searchParams.append('data[0]', 'price');
  url.searchParams.append('facets[stateid][]', state);
  url.searchParams.append('facets[sectorid][]', sector);
  url.searchParams.append('sort[0][column]', 'period');
  url.searchParams.append('sort[0][direction]', 'desc');
  url.searchParams.set('length', '1');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`EIA error ${res.status}`);
  const body: any = await res.json();
  const row = body?.response?.data?.[0];
  if (!row || row.price == null) return null;

  return {
    fuel: 'electricity',
    state,
    rateValue: parseFloat(String(row.price)) / 100,  // cents -> dollars
    unit: '$/kWh',
    period: row.period,
  };
}

/**
 * Fetch latest natural gas industrial price ($/MCF) for a US state.
 */
export async function fetchNaturalGasPrice(state: string): Promise<EnergyPrice | null> {
  const key = requireKey();
  const url = new URL(`${BASE}/natural-gas/pri/sum/data/`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('frequency', 'monthly');
  url.searchParams.append('data[0]', 'value');
  url.searchParams.append('facets[duoarea][]', `S${state}`);
  url.searchParams.append('sort[0][column]', 'period');
  url.searchParams.append('sort[0][direction]', 'desc');
  url.searchParams.set('length', '1');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`EIA error ${res.status}`);
  const body: any = await res.json();
  const row = body?.response?.data?.[0];
  if (!row || row.value == null) return null;
  return {
    fuel: 'natural_gas',
    state,
    rateValue: parseFloat(String(row.value)),
    unit: '$/MCF',
    period: row.period,
  };
}
