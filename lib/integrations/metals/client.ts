// lib/integrations/metals/client.ts
// Docs: https://metals-api.com/documentation
// Free tier: 100 req/month.
// LME base metals (ALU, XCU, ZNC, NIK, LEA, TIN, STL) are quoted in USD per tonne;
// we convert to USD per kg by dividing by 1000.

const BASE = 'https://metals-api.com/api/latest';

export interface MetalPrice {
  symbol: string;
  pricePerKg: number;    // USD per kg
  base: string;          // always 'USD'
}

export async function fetchMetalPrice(symbol: string): Promise<MetalPrice | null> {
  const key = process.env.METALS_API_KEY;
  if (!key) {
    throw new Error('METALS_API_KEY not configured — sign up at https://metals-api.com/');
  }

  const url = `${BASE}?access_key=${encodeURIComponent(key)}&base=USD&symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Metals-API error ${res.status}`);

  const body: any = await res.json();
  if (!body.success) return null;
  const pricePerTonne = body?.rates?.[symbol];
  if (pricePerTonne == null) return null;

  return {
    symbol,
    pricePerKg: Number(pricePerTonne) / 1000,
    base: body.base ?? 'USD',
  };
}

// Common metal symbols → substance name mapping used by v3 auto-populate / imports.
export const METAL_SYMBOL_TO_SUBSTANCE: Record<string, string> = {
  ALU: 'Aluminum, primary',
  XCU: 'Copper, primary',
  ZNC: 'Zinc powder, economical',
  NIK: 'Nickel',
  LEA: 'Lead',
  TIN: 'Tin',
  STL: 'Steel, reinforced',
};
