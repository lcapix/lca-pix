'use client'

// Labor = hours × rate for one step (item 5), with an optional live BLS
// state-level wage (item 2). The rate starts at the static national
// reference for the step's occupation; picking a state fetches that state's
// wage and re-costs the hours. For rows ingested before hours were persisted,
// hours are back-derived from cost ÷ rate so the calculation still reads.

import { useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { getLaborRate } from '@/lib/integrations/reference-rates'
import { laborCostFor, laborHoursPatch, laborHoursShown } from './cost-calculators'
import type { InspectorEditFormData } from './types'

// US state codes for the labor-wage location picker (state-level BLS wages).
// 'US' (national) is the default and lives in the <select> directly.
export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY',
]

export function useLaborRate({
  nodeLabel,
  editFormData,
  onChange,
}: {
  nodeLabel: string
  editFormData: InspectorEditFormData
  onChange: (patch: Partial<InspectorEditFormData>) => void
}) {
  const staticRate = getLaborRate(nodeLabel)
  // Live BLS state wage overrides the static national rate once the user picks
  // a state. null = use the static national reference.
  const [state, setState] = useState('US')
  const [liveRate, setLiveRate] = useState<{ rate: number; source: string } | null>(null)
  const [wageLoading, setWageLoading] = useState(false)

  const rate = liveRate ? liveRate.rate : staticRate.rate
  const rateLabel = liveRate ? liveRate.source : `${staticRate.label} · BLS OEWS national`

  const hoursVal = laborHoursShown(editFormData.laborHours, editFormData.laborCost, rate)
  const computed = hoursVal != null ? laborCostFor(hoursVal, rate) : undefined

  const recost = (r: number) => {
    if (hoursVal != null)
      onChange({
        laborCost: laborCostFor(hoursVal, r),
        laborOccupation: staticRate.soc,
      })
  }

  /** Pick a wage location: national (static) or a state (live BLS). */
  const pickState = async (next: string) => {
    setState(next)
    if (next === 'US') {
      setLiveRate(null)
      recost(staticRate.rate)
      return
    }
    setWageLoading(true)
    try {
      const res = await apiRequest('/api/integrations/bls/fetch-wage', {
        method: 'POST',
        body: JSON.stringify({ occupation: staticRate.soc, state: next }),
      })
      const d = await res.json()
      if (res.ok && d?.success && d.rate?.rateValue) {
        const r = Number(d.rate.rateValue)
        setLiveRate({ rate: r, source: `${d.rate.source} · ${next}` })
        recost(r)
      }
    } catch {
      // Network/BLS failure: keep the static national rate in place.
    } finally {
      setWageLoading(false)
    }
  }

  /** Typing hours: store them, the wage's SOC code, and the cost at this rate. */
  const setHours = (raw: string) =>
    onChange(laborHoursPatch(raw, rate, staticRate.soc, editFormData.laborCost))

  return { state, pickState, rate, rateLabel, wageLoading, hoursVal, computed, setHours }
}
