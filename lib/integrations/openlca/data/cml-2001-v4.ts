// lib/integrations/openlca/data/cml-2001-v4.ts
// Curated subset of CML 2001 (baseline) characterization factors, v4.4.
// Source: openLCA LCIA Method package 2.7.4 (public domain data).
// Keyed by CAS number where possible, with an alias list for name matching.

export interface FactorSeed {
  substanceName: string;      // canonical
  casNumber: string | null;
  aliases: string[];          // alternative names used in flow DBs
  factors: Array<{
    impactCategory: string;   // must match impact_categories.category_name
    value: number;
    unit: string;
  }>;
}

export const CML_2001_V4_FACTORS: FactorSeed[] = [
  // ── Greenhouse gases ────────────────────────────────────────────
  { substanceName: 'Carbon Dioxide', casNumber: '124-38-9',
    aliases: ['Carbon dioxide (CO2)', 'CO2', 'CO₂'],
    factors: [{ impactCategory: 'Global Warming', value: 1.0, unit: 'kg CO2 eq' }] },

  { substanceName: 'Methane', casNumber: '74-82-8',
    aliases: ['CH4', 'Natural Gas'],
    factors: [{ impactCategory: 'Global Warming', value: 28.0, unit: 'kg CO2 eq' }] },

  { substanceName: 'Nitrous Oxide', casNumber: '10024-97-2',
    aliases: ['N2O', 'Dinitrogen monoxide'],
    factors: [
      { impactCategory: 'Global Warming', value: 265.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Ozone Depletion', value: 0.017, unit: 'kg CFC-11 eq' },
    ] },

  // ── Acidifying / Eutrophying / Smog ─────────────────────────────
  { substanceName: 'Sulfur Dioxide', casNumber: '7446-09-5',
    aliases: ['SO2', 'Sulphur dioxide'],
    factors: [
      { impactCategory: 'Acidification', value: 1.0, unit: 'kg SO2 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.048, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Nitrogen Oxides', casNumber: '10102-44-0',
    aliases: ['NOx', 'Nitrogen oxides (NOx)', 'NO2'],
    factors: [
      { impactCategory: 'Acidification', value: 0.7, unit: 'kg SO2 eq' },
      { impactCategory: 'Eutrophication', value: 0.13, unit: 'kg PO4 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.028, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Particulate Matter (PM2.5)', casNumber: null,
    aliases: ['PM2.5', 'Particulate matter (PM10)', 'PM10'],
    factors: [
      { impactCategory: 'Human Toxicity', value: 0.82, unit: 'kg 1,4-DB eq' },
    ] },

  // ── Resources / materials (aggregated process factors) ──────────
  { substanceName: 'Steel, reinforced', casNumber: null,
    aliases: ['Steel', 'Cast iron', 'Carbon steel'],
    factors: [
      { impactCategory: 'Global Warming', value: 1.8, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.005, unit: 'kg SO2 eq' },
      { impactCategory: 'Human Toxicity', value: 0.12, unit: 'kg 1,4-DB eq' },
      { impactCategory: 'Resource Depletion', value: 0.0011, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Aluminum, primary', casNumber: '7429-90-5',
    aliases: ['Aluminum', 'Aluminum alloy, economical', 'Aluminium'],
    factors: [
      { impactCategory: 'Global Warming', value: 8.2, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.035, unit: 'kg SO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0042, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Copper, primary', casNumber: '7440-50-8',
    aliases: ['Copper'],
    factors: [
      { impactCategory: 'Global Warming', value: 3.5, unit: 'kg CO2 eq' },
      { impactCategory: 'Human Toxicity', value: 5.4, unit: 'kg 1,4-DB eq' },
      { impactCategory: 'Resource Depletion', value: 0.0098, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Zinc powder, economical', casNumber: '7440-66-6',
    aliases: ['Zinc'],
    factors: [
      { impactCategory: 'Global Warming', value: 3.1, unit: 'kg CO2 eq' },
      { impactCategory: 'Ecotoxicity', value: 1.7, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Platinum, primary', casNumber: '7440-06-4',
    aliases: ['Platinum'],
    factors: [
      { impactCategory: 'Global Warming', value: 12500.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.15, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Glass fiber reinforced polymer (GFRP)', casNumber: null,
    aliases: ['GFRP'],
    factors: [
      { impactCategory: 'Global Warming', value: 2.9, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.012, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Polyethylene, high density (HDPE)', casNumber: '9002-88-4',
    aliases: ['HDPE', 'Polyethylene'],
    factors: [
      { impactCategory: 'Global Warming', value: 1.9, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0013, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Polycarbonate', casNumber: '25037-45-0',
    aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 4.1, unit: 'kg CO2 eq' },
    ] },

  { substanceName: 'Epoxy resin', casNumber: '25036-25-3',
    aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 5.8, unit: 'kg CO2 eq' },
      { impactCategory: 'Human Toxicity', value: 2.1, unit: 'kg 1,4-DB eq' },
    ] },

  // ── Energy ──────────────────────────────────────────────────────
  { substanceName: 'Electricity', casNumber: null,
    aliases: ['Electricity, grid mix', 'Manufacturing energy'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.42, unit: 'kg CO2 eq' },     // global avg
      { impactCategory: 'Acidification', value: 0.0018, unit: 'kg SO2 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.00035, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Natural Gas', casNumber: '74-82-8',
    aliases: ['Natural gas'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.056, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.0003, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Crude Oil', casNumber: '8002-05-9',
    aliases: ['Lubricating oil', 'Hydraulic fluid'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.45, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0021, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Coal', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 2.4, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.008, unit: 'kg SO2 eq' },
    ] },

  // ── Transport ───────────────────────────────────────────────────
  { substanceName: 'Transport, truck, long-haul', casNumber: null,
    aliases: ['Transport, truck, regional', 'Truck Transport'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.107, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.00045, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Transport, ocean freight', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 0.011, unit: 'kg CO2 eq' },
    ] },

  // ── Waste / Water ───────────────────────────────────────────────
  { substanceName: 'Wastewater', casNumber: null,
    aliases: ['Wastewater, industrial'],
    factors: [
      { impactCategory: 'Eutrophication', value: 0.42, unit: 'kg PO4 eq' },
      { impactCategory: 'Ecotoxicity', value: 0.88, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Solid Waste', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Human Toxicity', value: 0.005, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Refrigerant R-410A', casNumber: null,
    aliases: ['R-410A'],
    factors: [
      { impactCategory: 'Global Warming', value: 2088.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Ozone Depletion', value: 0.0, unit: 'kg CFC-11 eq' },
    ] },
];

export const CML_2001_METHOD_NAME = 'CML 2001';
