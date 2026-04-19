// lib/integrations/openlca/data/recipe-midpoint-h.ts
// Curated subset of ReCiPe 2016 Midpoint (H) characterization factors.
// Source: openLCA LCIA Method package 2.7.4 + published ReCiPe 2016 literature.
// Values are representative midpoint factors for the 8 CML-aligned impact categories.

import type { FactorSeed } from './cml-2001-v4';

export const RECIPE_MIDPOINT_H_FACTORS: FactorSeed[] = [
  // ── GHGs ────────────────────────────────────────────────────────
  { substanceName: 'Carbon Dioxide', casNumber: '124-38-9',
    aliases: ['Carbon dioxide (CO2)', 'CO2', 'CO₂'],
    factors: [
      { impactCategory: 'Global Warming', value: 1.0, unit: 'kg CO2 eq' },
    ] },

  { substanceName: 'Methane', casNumber: '74-82-8',
    aliases: ['CH4'],
    factors: [
      { impactCategory: 'Global Warming', value: 34.0, unit: 'kg CO2 eq' },  // ReCiPe 2016 H
    ] },

  { substanceName: 'Nitrous Oxide', casNumber: '10024-97-2',
    aliases: ['N2O'],
    factors: [
      { impactCategory: 'Global Warming', value: 298.0, unit: 'kg CO2 eq' },  // ReCiPe 2016 H
      { impactCategory: 'Ozone Depletion', value: 0.011, unit: 'kg CFC-11 eq' },
    ] },

  { substanceName: 'Sulfur Dioxide', casNumber: '7446-09-5',
    aliases: ['SO2'],
    factors: [
      { impactCategory: 'Acidification', value: 1.0, unit: 'kg SO2 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.078, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Nitrogen Oxides', casNumber: '10102-44-0',
    aliases: ['NOx'],
    factors: [
      { impactCategory: 'Acidification', value: 0.56, unit: 'kg SO2 eq' },
      { impactCategory: 'Eutrophication', value: 0.13, unit: 'kg PO4 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 1.22, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Particulate Matter (PM2.5)', casNumber: null,
    aliases: ['PM2.5', 'PM10'],
    factors: [
      { impactCategory: 'Human Toxicity', value: 1.2, unit: 'kg 1,4-DB eq' },
    ] },

  // ── Materials (process factors) ─────────────────────────────────
  { substanceName: 'Steel, reinforced', casNumber: null,
    aliases: ['Steel', 'Cast iron'],
    factors: [
      { impactCategory: 'Global Warming', value: 2.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.007, unit: 'kg SO2 eq' },
      { impactCategory: 'Human Toxicity', value: 0.15, unit: 'kg 1,4-DB eq' },
      { impactCategory: 'Resource Depletion', value: 0.0013, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Aluminum, primary', casNumber: '7429-90-5',
    aliases: ['Aluminum', 'Aluminium'],
    factors: [
      { impactCategory: 'Global Warming', value: 9.1, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.042, unit: 'kg SO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0048, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Copper, primary', casNumber: '7440-50-8',
    aliases: ['Copper'],
    factors: [
      { impactCategory: 'Global Warming', value: 4.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Human Toxicity', value: 6.2, unit: 'kg 1,4-DB eq' },
      { impactCategory: 'Resource Depletion', value: 0.0112, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Zinc powder, economical', casNumber: '7440-66-6',
    aliases: ['Zinc'],
    factors: [
      { impactCategory: 'Global Warming', value: 3.5, unit: 'kg CO2 eq' },
      { impactCategory: 'Ecotoxicity', value: 2.1, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Platinum, primary', casNumber: '7440-06-4',
    aliases: ['Platinum'],
    factors: [
      { impactCategory: 'Global Warming', value: 13200.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.17, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Glass fiber reinforced polymer (GFRP)', casNumber: null,
    aliases: ['GFRP'],
    factors: [
      { impactCategory: 'Global Warming', value: 3.2, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.014, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Polyethylene, high density (HDPE)', casNumber: '9002-88-4',
    aliases: ['HDPE'],
    factors: [
      { impactCategory: 'Global Warming', value: 2.1, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0015, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Polycarbonate', casNumber: '25037-45-0',
    aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 4.5, unit: 'kg CO2 eq' },
    ] },

  { substanceName: 'Epoxy resin', casNumber: '25036-25-3',
    aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 6.3, unit: 'kg CO2 eq' },
      { impactCategory: 'Human Toxicity', value: 2.4, unit: 'kg 1,4-DB eq' },
    ] },

  // ── Energy ──────────────────────────────────────────────────────
  { substanceName: 'Electricity', casNumber: null,
    aliases: ['Electricity, grid mix'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.48, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.0022, unit: 'kg SO2 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.00042, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Natural Gas', casNumber: '74-82-8',
    aliases: ['Natural gas'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.062, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.00035, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Crude Oil', casNumber: '8002-05-9',
    aliases: ['Lubricating oil'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.50, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0024, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Coal', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 2.7, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.009, unit: 'kg SO2 eq' },
    ] },

  // ── Transport ───────────────────────────────────────────────────
  { substanceName: 'Transport, truck, long-haul', casNumber: null,
    aliases: ['Transport, truck, regional', 'Truck Transport'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.118, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.00050, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Transport, ocean freight', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 0.013, unit: 'kg CO2 eq' },
    ] },

  { substanceName: 'Wastewater', casNumber: null,
    aliases: ['Wastewater, industrial'],
    factors: [
      { impactCategory: 'Eutrophication', value: 0.45, unit: 'kg PO4 eq' },
      { impactCategory: 'Ecotoxicity', value: 0.92, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Solid Waste', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Human Toxicity', value: 0.006, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Refrigerant R-410A', casNumber: null,
    aliases: ['R-410A'],
    factors: [
      { impactCategory: 'Global Warming', value: 2088.0, unit: 'kg CO2 eq' },
    ] },
];

export const RECIPE_MIDPOINT_H_METHOD_NAME = 'ReCiPe Midpoint (H)';
