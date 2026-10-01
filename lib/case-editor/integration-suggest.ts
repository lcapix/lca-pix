'use client'

// "Suggest from integrations" in the component dialog: rough labor, energy
// and material defaults from BLS / EIA / Metals-API (or the curated USGS /
// market rate for non-metals), scaled by the node's quantity. When every
// source returns nothing (offline / no API keys) an offline fallback is
// shown so the feature still demonstrates, and says it is a fallback.

import { useMemo, useState } from 'react'
import { pickMaterialRate } from '@/lib/integrations/reference-rates'

export interface IntegrationSuggestion {
  labor?: number
  energy?: number
  material?: number
}

export interface IntegrationWants {
  labor: boolean
  energy: boolean
  material: boolean
}

/** Heuristic: what to ask the integrations for, by node type. */
export function integrationWantsFor(componentType: string): IntegrationWants {
  const t = (componentType || '').toLowerCase()
  return {
    labor: /machine|subprocess|operation/.test(t),
    energy: /operation|elemental/.test(t),
    material: /elemental|subprocess/.test(t),
  }
}

// Metals-API uses 3-letter codes; a metal name maps to its code.
const METAL_SYMBOL: Array<[RegExp, string]> = [
  [/alumin/i, 'ALU'], [/copper/i, 'XCU'], [/zinc|galvani/i, 'ZNC'],
  [/nickel/i, 'NIK'], [/lead/i, 'LEA'], [/\btin\b/i, 'TIN'],
  [/steel|iron/i, 'STL'],
]

/** The Metals-API symbol for the metal a node is named after, if any. */
export function metalSymbolFor(nodeName?: string): string | undefined {
  return METAL_SYMBOL.find(([re]) => re.test(nodeName || ''))?.[1]
}

/**
 * Ask the integrations (same requests as always: POST with the bearer token
 * to bls/fetch-wage, eia/fetch-energy-price, metals/fetch-price) and price
 * the node. Throws only if a request throws.
 */
export async function fetchIntegrationSuggestion(
  { wants, nodeName, quantity, region }: { wants: IntegrationWants; nodeName?: string; quantity: number; region: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ sources: string[]; payload: IntegrationSuggestion }> {
  const sources: string[] = []
  const payload: IntegrationSuggestion = {}
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = 'Bearer ' + token
  const q = Math.max(1, Number(quantity) || 1)

  if (wants.labor) {
    // BLS OEWS 51-4121 = Welders / 51-4041 = Machinists. Default to welders.
    const r = await fetchImpl('/api/integrations/bls/fetch-wage', {
      method: 'POST',
      headers,
      body: JSON.stringify({ occupation: '51-4121', state: region }),
    })
    if (r.ok) {
      const d = await r.json()
      const hourly = Number(d?.rate?.rateValue ?? d?.hourlyRate ?? 0)
      if (hourly > 0) {
        // Assume 0.5h labor per unit.
        payload.labor = Math.round(hourly * 0.5 * q * 100) / 100
        sources.push(`BLS $${hourly.toFixed(2)}/hr × 0.5h × ${q}`)
      }
    }
  }
  if (wants.energy) {
    // EIA route's zod schema requires `state` (2-letter code), not `region`.
    const r = await fetchImpl('/api/integrations/eia/fetch-energy-price', {
      method: 'POST',
      headers,
      body: JSON.stringify({ fuel: 'electricity', state: region }),
    })
    if (r.ok) {
      const d = await r.json()
      const perKwh = Number(d?.rate?.rateValue ?? d?.pricePerKwh ?? 0)
      if (perKwh > 0) {
        // Assume 2 kWh per unit (typical operation).
        payload.energy = Math.round(perKwh * 2 * q * 100) / 100
        sources.push(`EIA $${perKwh.toFixed(3)}/kWh × 2 kWh × ${q}`)
      }
    }
  }
  if (wants.material) {
    // Price the ACTUAL material named on the node, not a hardcoded metal;
    // anything that is not a metal falls back to the curated reference rate.
    const symbol = metalSymbolFor(nodeName)
    if (symbol) {
      const r = await fetchImpl('/api/integrations/metals/fetch-price', {
        method: 'POST',
        headers,
        body: JSON.stringify({ symbol }),
      })
      if (r.ok) {
        const d = await r.json()
        const perKg = Number(d?.rate?.rateValue ?? d?.pricePerKg ?? 0)
        if (perKg > 0) {
          payload.material = Math.round(perKg * q * 100) / 100
          sources.push(`Metals-API ${symbol} $${perKg.toFixed(2)}/kg × ${q}`)
        }
      }
    } else {
      // Non-metal (plastic, glass, wood, …): curated USGS/market rate.
      const mr = pickMaterialRate(nodeName)
      payload.material = Math.round(mr.rate * q * 100) / 100
      sources.push(`${mr.label} $${mr.rate.toFixed(2)}/kg × ${q}`)
    }
  }

  // If all three returned nothing (offline / no API keys), surface a
  // sensible offline fallback so the UX still demonstrates the feature.
  if (payload.labor == null && payload.energy == null && payload.material == null) {
    if (wants.labor) {
      payload.labor = Math.round(24 * 0.5 * q * 100) / 100
      sources.push(`BLS fallback $24.00/hr × 0.5h × ${q}`)
    }
    if (wants.energy) {
      payload.energy = Math.round(0.13 * 2 * q * 100) / 100
      sources.push(`EIA fallback $0.130/kWh × 2 kWh × ${q}`)
    }
    if (wants.material) {
      const mr = pickMaterialRate(nodeName)
      payload.material = Math.round(mr.rate * q * 100) / 100
      sources.push(`${mr.label} (offline) $${mr.rate.toFixed(2)}/kg × ${q}`)
    }
  }

  return { sources, payload }
}

/** State for the suggest panel: fetch, show, dismiss. */
export function useIntegrationSuggest({
  componentType,
  nodeName,
  quantity,
  region,
}: {
  componentType: string
  nodeName?: string
  quantity: number
  region: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ sources: string[]; payload: IntegrationSuggestion } | null>(null)

  const wants = useMemo(() => integrationWantsFor(componentType), [componentType])

  async function suggest() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(await fetchIntegrationSuggestion({ wants, nodeName, quantity, region }))
    } catch (e: any) {
      setError(e?.message ?? 'Suggest failed')
    } finally {
      setLoading(false)
    }
  }

  const dismiss = () => setResult(null)

  return { wants, loading, error, result, suggest, dismiss }
}
