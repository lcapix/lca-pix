// The inspector's calculators as plain arithmetic: labor (hours × rate),
// machine energy (hours × kW × load), and the allocation share. Rounding is
// to the cent for money and to 0.001 for hours and kWh.

import type { InspectorEditFormData } from './types'

/* ── Labor = hours × rate ─────────────────────────────────────────────── */

/**
 * Whether a step shows the labor calculator. Node types reach the inspector
 * normalized ('Operation', 'Task'); the raw DB names are accepted too (EDIT-4:
 * only the raw names were checked, so the calculator never showed on a step
 * with no labor yet). Any step that already has labor shows it.
 */
export function isLaborNode(nodeType: string, fd: Pick<InspectorEditFormData, 'laborCost' | 'laborHours'>): boolean {
  return (
    ['Operation', 'Task', 'operation', 'elemental_task'].includes(nodeType) ||
    fd.laborCost != null ||
    fd.laborHours != null
  )
}

/** Labor cost for some hours at a rate, to the cent. */
export const laborCostFor = (hours: number, rate: number) => Math.round(hours * rate * 100) / 100

/**
 * The hours shown: the stored hours, or for rows saved before hours were
 * kept, the hours the stored cost implies at this rate.
 */
export function laborHoursShown(
  storedHours: number | undefined,
  laborCost: number | undefined,
  rate: number,
): number | undefined {
  return (
    storedHours ??
    (laborCost != null && rate ? Math.round((laborCost / rate) * 1000) / 1000 : undefined)
  )
}

/** The form change when hours are typed: hours, the wage's SOC code, and the cost. */
export function laborHoursPatch(
  raw: string,
  rate: number,
  soc: string,
  currentLaborCost: number | undefined,
): Partial<InspectorEditFormData> {
  return {
    laborHours: raw === '' ? undefined : Number(raw),
    laborOccupation: soc,
    laborCost: raw === '' ? currentLaborCost : laborCostFor(Number(raw), rate),
  }
}

/* ── Machine energy = run hours × rated kW × load ─────────────────────── */

export interface MachineEnergyInput {
  hours: string
  kw: string
  loadPct: string
  /** $/kWh. */
  price: string
  /** Optional machine-hour rate, $/h. */
  machineRate: string
}

export interface MachineEnergyResult {
  h: number
  p: number
  l: number
  /** null until hours, kW and load are all above 0. */
  kwh: number | null
  energyCost: number | null
  equipmentCost: number | null
}

export function machineEnergy({ hours, kw, loadPct, price, machineRate }: MachineEnergyInput): MachineEnergyResult {
  const h = Number(hours)
  const p = Number(kw)
  const l = Number(loadPct)
  const kwh = h > 0 && p > 0 && l > 0 ? Math.round(h * p * (l / 100) * 1000) / 1000 : null
  const energyCost =
    kwh != null && Number(price) > 0 ? Math.round(kwh * Number(price) * 100) / 100 : null
  const equipmentCost =
    h > 0 && Number(machineRate) > 0 ? Math.round(h * Number(machineRate) * 100) / 100 : null
  return { h, p, l, kwh, energyCost, equipmentCost }
}

/** How the electricity flow records where its kWh came from. */
export const machineEnergyDescription = (h: number, p: number, l: number) =>
  `Machine energy: ${h} h × ${p} kW × ${l}% load`

/* ── Allocation (ISO 14044 4.3.4) ─────────────────────────────────────── */

export type AllocationChoice = 'none' | 'physical' | 'economic'

/**
 * The editor's view of the stored allocation: the method (system expansion
 * is not offered, so it reads as none) and the share as a percent, 0.1 steps.
 */
export function allocationView(fd: Pick<InspectorEditFormData, 'allocationMethod' | 'allocationFactor'>): {
  method: AllocationChoice
  share: number | undefined
  pctValue: number | ''
} {
  const method: AllocationChoice =
    fd.allocationMethod === 'physical' || fd.allocationMethod === 'economic' ? fd.allocationMethod : 'none'
  const share = fd.allocationFactor
  const pctValue: number | '' =
    method === 'none' ? 100 : share == null ? '' : Math.round(share * 1000) / 10
  return { method, share, pctValue }
}

/** Choosing a method: none counts the node in full; a split keeps a share below 1. */
export function allocationMethodPatch(
  m: AllocationChoice,
  share: number | undefined,
): Partial<InspectorEditFormData> {
  return m === 'none'
    ? { allocationMethod: 'none', allocationFactor: 1 }
    : {
        allocationMethod: m,
        allocationFactor: share != null && share < 1 ? share : undefined,
      }
}

/**
 * Typing the percent: blank clears the share, a number is clamped to
 * 0.1–100 % and stored 0..1, anything else is ignored (null).
 */
export function allocationSharePatch(raw: string): Partial<InspectorEditFormData> | null {
  if (raw === '') return { allocationFactor: undefined }
  const p = Number(raw)
  if (!Number.isFinite(p)) return null
  return { allocationFactor: Math.min(1, Math.max(0.001, p / 100)) }
}
