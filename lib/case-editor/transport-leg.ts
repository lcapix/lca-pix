// Transport legs (TKM-1 / TKM-2 / TKM-4). A transport substance is quantified
// in tonne-km (freight work = mass × distance); a user enters the mass in
// tonnes and the distance in km and the quantity is worked out, never typed.

/** A transport substance: catalog unit tkm, or a transport / freight / haul name. */
export function isTransportSubstance(s: { unit?: string; substance_name?: string } | null | undefined): boolean {
  return (
    !!s &&
    ((s.unit || '').toLowerCase() === 'tkm' || /transport|freight|haul/i.test(s.substance_name || ''))
  )
}

/** A leg number: above 0, else null (blank, 0, negative, not a number). */
export const legNumber = (v: string): number | null => {
  const n = v.trim() === '' ? NaN : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** t × km, without float noise (0.1 × 3 is 0.3, not 0.30000000000000004); null unless both are above 0. */
export const tkmOf = (massT: string, km: string): number | null => {
  const t = legNumber(massT)
  const d = legNumber(km)
  return t != null && d != null ? Number((t * d).toPrecision(12)) : null
}

/**
 * The leg as the add form sees it: its tonne-km, whether it is in use (a
 * transport substance with either number typed), and whether a typed number
 * is unusable (which blocks Save flow).
 */
export function legState(isTransportLeg: boolean, massT: string, km: string) {
  const legTkm = tkmOf(massT, km)
  const legInUse = isTransportLeg && (massT !== '' || km !== '')
  const legInvalid =
    legInUse && ((massT !== '' && legNumber(massT) == null) || (km !== '' && legNumber(km) == null))
  return { legTkm, legInUse, legInvalid }
}

/**
 * The two numbers saved with the flow. A leg is entered as mass × distance
 * but stored as tonne-km, which cannot be read back (finding #70).
 */
export function legPayload(massT: string, km: string) {
  return {
    transport_mass_kg: Number(massT) * 1000,
    transport_distance_km: Number(km),
  }
}
