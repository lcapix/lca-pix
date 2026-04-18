// lib/integrations/bls/occupations.ts
// Curated subset of BLS OEWS occupation codes useful for manufacturing LCAs.
export const OCCUPATIONS = [
  { code: '51-4121', title: 'Welders, Cutters, Solderers, and Brazers' },
  { code: '51-4041', title: 'Machinists' },
  { code: '51-2090', title: 'Miscellaneous Assemblers and Fabricators' },
  { code: '51-8021', title: 'Stationary Engineers and Boiler Operators' },
  { code: '51-8091', title: 'Chemical Plant and System Operators' },
  { code: '51-9141', title: 'Semiconductor Processing Technicians' },
  { code: '51-9011', title: 'Chemical Equipment Operators' },
  { code: '11-9041', title: 'Architectural and Engineering Managers' },
  { code: '17-2112', title: 'Industrial Engineers' },
  { code: '19-2031', title: 'Chemists' },
] as const;

export type OccupationCode = typeof OCCUPATIONS[number]['code'];
