'use client'

// Machine energy on a process step: run hours × rated kW × load = kWh.
// Every multiplicand is entered by the user (routing, nameplate, meter); the
// only reference value is the EIA electricity price, which stays editable.
// The kWh becomes an Electricity input flow, so the grid factor for the run's
// region turns it into emissions; its cost can fill the energy cost field.

import { useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import { ENERGY_RATES } from '@/lib/integrations/reference-rates'
import { machineEnergy, machineEnergyDescription } from './cost-calculators'

export function useMachineEnergy(componentId: string) {
  const [hours, setHours] = useState('')
  const [kw, setKw] = useState('')
  const [loadPct, setLoadPct] = useState('')
  const [price, setPrice] = useState(String(ENERGY_RATES.electricity_industrial.rate))
  const [machineRate, setMachineRate] = useState('')
  const [adding, setAdding] = useState(false)

  const { h, p, l, kwh, energyCost, equipmentCost } = machineEnergy({ hours, kw, loadPct, price, machineRate })

  /** Add the kWh to the step as an Electricity input, then tell the editor. */
  const addElectricityFlow = async () => {
    if (kwh == null) return
    setAdding(true)
    try {
      const subs = await apiRequest('/api/substances').then((r) => r.json())
      const elec = (subs?.substances ?? subs?.data ?? []).find(
        (s: any) => s.substance_name === 'Electricity',
      )
      if (!elec) throw new Error('No "Electricity" substance in the catalog')
      const res = await apiRequest(`/api/components/${componentId}/flows`, {
        method: 'POST',
        body: JSON.stringify({
          substance_id: elec.substance_id,
          flow_type: 'input',
          quantity: kwh,
          unit: 'kWh',
          driver_description: machineEnergyDescription(h, p, l),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Could not add the flow')
      }
      window.dispatchEvent(new Event('lcapix:flows-changed'))
      window.dispatchEvent(new Event('lcapix:components-changed'))
      toast.success(`Added ${kwh} kWh of electricity as an input`)
    } catch (e: any) {
      toast.error(e?.message || 'Could not add the flow')
    } finally {
      setAdding(false)
    }
  }

  return {
    hours,
    setHours,
    kw,
    setKw,
    loadPct,
    setLoadPct,
    price,
    setPrice,
    machineRate,
    setMachineRate,
    kwh,
    energyCost,
    equipmentCost,
    adding,
    addElectricityFlow,
  }
}
