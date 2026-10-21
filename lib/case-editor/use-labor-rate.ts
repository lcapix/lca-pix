'use client'

// Labor = hours × rate for one step (item 5), with an optional live BLS
// state-level wage (item 2). The rate starts at the static national
// reference for the step's occupation; picking a state fetches that state's
// wage and re-costs the hours. For rows ingested before hours were persisted,
// hours are back-derived from cost ÷ rate so the calculation still reads.
//
// A reference wage is a starting point, not the truth: the trade is a choice
// (it used to be read off the step's name, so "Station 3" was paid the generic
// production wage), and a shop can type the rate it actually pays, which is
// recorded as 'user' (labor_occupation is varchar(10)) and labelled as theirs.

import { useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { LABOR_RATES, getLaborRate } from '@/lib/integrations/reference-rates'
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
  // The trade picked for this step ('' = matched on the step's name), and a
  // rate typed by the user ('' = use the reference wage).
  const [tradeKey, setTradeKey] = useState('')
  const [typedRate, setTypedRate] = useState('')
  // Said when a state's live wage could not be had and the national reference
  // is in force instead, so the picker never shows one state while the cost
  // carries another's wage.
  const [wageNote, setWageNote] = useState('')

  const reference = (tradeKey && LABOR_RATES[tradeKey]) || staticRate
  // A rate typed earlier is not kept in this panel once it is closed or the
  // page reloads, but the step remembers it: occupation 'user' with the cost
  // and hours saved. Read it back as cost ÷ hours, or the breakdown would show
  // the reference wage beside a cost that was saved at the user's own.
  const savedHours = Number(editFormData.laborHours)
  const savedUserRate =
    editFormData.laborOccupation === 'user' && savedHours > 0 && editFormData.laborCost != null
      ? Math.round((Number(editFormData.laborCost) / savedHours) * 100) / 100
      : null
  const typed =
    typedRate.trim() !== '' && Number.isFinite(Number(typedRate)) ? Number(typedRate) : savedUserRate
  const rate = typed ?? (liveRate ? liveRate.rate : reference.rate)
  const rateLabel =
    typed != null
      ? 'entered by you, not a published wage'
      : liveRate
        ? liveRate.source
        : `${reference.label} · BLS OEWS national${tradeKey ? '' : ' · matched on the step name'}`

  const hoursVal = laborHoursShown(editFormData.laborHours, editFormData.laborCost, rate)
  const computed = hoursVal != null ? laborCostFor(hoursVal, rate) : undefined

  const recost = (r: number, soc: string) => {
    if (hoursVal != null)
      onChange({
        laborCost: laborCostFor(hoursVal, r),
        laborOccupation: soc,
      })
  }

  /**
   * Fetch a state's live BLS wage for a trade and re-cost. When there is none
   * (no data, an error, offline), drop any live wage and say the national
   * reference is in force; false then, and the caller re-costs if needed.
   */
  const loadStateWage = async (stateCode: string, trade: { soc: string }): Promise<boolean> => {
    setWageLoading(true)
    setWageNote('')
    try {
      const res = await apiRequest('/api/integrations/bls/fetch-wage', {
        method: 'POST',
        body: JSON.stringify({ occupation: trade.soc, state: stateCode }),
      })
      const d = await res.json()
      if (res.ok && d?.success && d.rate?.rateValue) {
        const r = Number(d.rate.rateValue)
        setLiveRate({ rate: r, source: `${d.rate.source} · ${stateCode}` })
        recost(r, trade.soc)
        return true
      }
    } catch {
      // Network/BLS failure: handled below, like a state with no wage.
    } finally {
      setWageLoading(false)
    }
    setLiveRate(null)
    setWageNote(`No live BLS wage for ${stateCode} could be loaded, so the national reference is used.`)
    return false
  }

  /** Pick a wage location: national (static) or a state (live BLS). */
  const pickState = async (next: string) => {
    setState(next)
    setTypedRate('')
    if (next === 'US') {
      setLiveRate(null)
      setWageNote('')
      recost(reference.rate, reference.soc)
      return
    }
    // A failed lookup while the cost carries another state's wage, or the
    // user's own rate, puts it back on the national reference, so the cost
    // matches what is shown.
    if (!(await loadStateWage(next, reference)) && (liveRate || typed != null)) recost(reference.rate, reference.soc)
  }

  /** Pick the trade that does this step; the wage (national or the state's) follows it. */
  const pickTrade = async (key: string) => {
    const trade = (key && LABOR_RATES[key]) || staticRate
    setTradeKey(key)
    setTypedRate('')
    setLiveRate(null)
    if (state === 'US' || !(await loadStateWage(state, trade))) recost(trade.rate, trade.soc)
  }

  /** Type the rate the shop pays; clearing it goes back to the reference wage and its provenance. */
  const typeRate = (raw: string) => {
    setTypedRate(raw)
    if (raw.trim() === '') {
      recost(liveRate ? liveRate.rate : reference.rate, reference.soc)
      return
    }
    const r = Number(raw)
    // The hours go in the same patch: the whole triple makes the edit idempotent
    // and behaves exactly like the hours input beside it.
    if (Number.isFinite(r) && hoursVal != null)
      onChange({ laborHours: hoursVal, laborCost: laborCostFor(hoursVal, r), laborOccupation: 'user' })
  }

  /** Typing hours: store them, the wage's SOC code (or 'user' for a typed rate), and the cost at this rate. */
  const setHours = (raw: string) =>
    onChange(laborHoursPatch(raw, rate, typed != null ? 'user' : reference.soc, editFormData.laborCost))

  return {
    state, pickState, tradeKey, pickTrade, typedRate, typeRate,
    rate, rateLabel, wageNote, wageLoading, hoursVal, computed, setHours,
  }
}
