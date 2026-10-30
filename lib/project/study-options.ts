// The study settings a project can take, shared by New project and Project
// settings. Only the methods with factors loaded (driver_impact_factors) and
// the regions with their own electricity factors; anything else would quietly
// read as zero or fall back to Global.

export const METHODS = ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'] as const
export const REGIONS = [
  { value: 'Global', label: 'Global' },
  { value: 'US', label: 'United States' },
  { value: 'EU', label: 'Europe (EU-27)' },
] as const
export const BOUNDARIES = [
  { value: 'cradle-to-gate', label: 'Cradle-to-gate' },
  { value: 'gate-to-gate', label: 'Gate-to-gate' },
  { value: 'cradle-to-grave', label: 'Cradle-to-grave' },
] as const
