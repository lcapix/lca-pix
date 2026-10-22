// lib/integrations/openlca/data/traci-2.1.ts
// Curated subset of TRACI 2.1 (US EPA) characterization factors.
// Source: openLCA LCIA Method package 2.7.4 + US EPA TRACI documentation.

import type { FactorSeed } from './cml-2001-v4';

export const TRACI_21_FACTORS: FactorSeed[] = [
  { substanceName: 'Carbon Dioxide', basis: 'elementary', casNumber: '124-38-9',
    aliases: ['Carbon dioxide (CO2)', 'CO2', 'CO₂'],
    factors: [{ impactCategory: 'Global Warming', value: 1.0, unit: 'kg CO2 eq' }] },

  { substanceName: 'Methane', basis: 'elementary', casNumber: '74-82-8',
    aliases: ['CH4'],
    factors: [{ impactCategory: 'Global Warming', value: 25.0, unit: 'kg CO2 eq' }] },

  { substanceName: 'Nitrous Oxide', basis: 'elementary', casNumber: '10024-97-2',
    aliases: ['N2O'],
    factors: [
      { impactCategory: 'Global Warming', value: 298.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Ozone Depletion', value: 0.017, unit: 'kg CFC-11 eq' },
    ] },

  { substanceName: 'Sulfur Dioxide', basis: 'elementary', casNumber: '7446-09-5',
    aliases: ['SO2'],
    factors: [
      { impactCategory: 'Acidification', value: 1.0, unit: 'kg SO2 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.081, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Nitrogen Oxides', basis: 'elementary', casNumber: '10102-44-0',
    aliases: ['NOx'],
    factors: [
      { impactCategory: 'Acidification', value: 0.7, unit: 'kg SO2 eq' },
      { impactCategory: 'Eutrophication', value: 0.122, unit: 'kg PO4 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.031, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Particulate Matter (PM2.5)', basis: 'elementary', casNumber: null,
    aliases: ['PM2.5', 'PM10'],
    factors: [
      { impactCategory: 'Human Toxicity', value: 0.95, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Steel, reinforced', basis: 'embodied', casNumber: null,
    aliases: ['Steel', 'Cast iron'],
    factors: [
      { impactCategory: 'Global Warming', value: 1.9, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.006, unit: 'kg SO2 eq' },
      { impactCategory: 'Human Toxicity', value: 0.13, unit: 'kg 1,4-DB eq' },
      { impactCategory: 'Resource Depletion', value: 0.0012, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Aluminum, primary', basis: 'embodied', casNumber: '7429-90-5',
    aliases: ['Aluminum', 'Aluminium'],
    factors: [
      { impactCategory: 'Global Warming', value: 8.5, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.038, unit: 'kg SO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0045, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Copper, primary', basis: 'embodied', casNumber: '7440-50-8',
    aliases: ['Copper'],
    factors: [
      { impactCategory: 'Global Warming', value: 3.7, unit: 'kg CO2 eq' },
      { impactCategory: 'Human Toxicity', value: 5.8, unit: 'kg 1,4-DB eq' },
      { impactCategory: 'Resource Depletion', value: 0.0102, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Zinc powder, economical', basis: 'embodied', casNumber: '7440-66-6',
    aliases: ['Zinc'],
    factors: [
      { impactCategory: 'Global Warming', value: 3.2, unit: 'kg CO2 eq' },
      { impactCategory: 'Ecotoxicity', value: 1.8, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Platinum, primary', basis: 'embodied', casNumber: '7440-06-4',
    aliases: ['Platinum'],
    factors: [
      { impactCategory: 'Global Warming', value: 12800.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.16, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Glass fiber reinforced polymer (GFRP)', basis: 'embodied', casNumber: null,
    aliases: ['GFRP'],
    factors: [
      { impactCategory: 'Global Warming', value: 3.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.013, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Polyethylene, high density (HDPE)', basis: 'embodied', casNumber: '9002-88-4',
    aliases: ['HDPE'],
    factors: [
      { impactCategory: 'Global Warming', value: 2.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0014, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Polycarbonate', basis: 'embodied', casNumber: '25037-45-0',
    aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 4.3, unit: 'kg CO2 eq' },
    ] },

  { substanceName: 'Epoxy resin', basis: 'embodied', casNumber: '25036-25-3',
    aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 6.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Human Toxicity', value: 2.2, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Electricity', basis: 'embodied', casNumber: null,
    aliases: ['Electricity, grid mix'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.473, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.0020, unit: 'kg SO2 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.00039, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Natural Gas', basis: 'embodied', casNumber: null, // fuel mix, not CH4 (audit 2026-09-09)
    aliases: ['Natural gas'],
    factors: [
      // EPA GHG Emission Factors Hub 2025: 53.06 kg CO2/MMBtu ÷ 28.263 m3/MMBtu; combustion only
      { impactCategory: 'Global Warming', value: 1.877, unit: 'kg CO2 eq / m3' },
      { impactCategory: 'Acidification', value: 0.00032, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Crude Oil', basis: 'embodied', casNumber: '8002-05-9',
    aliases: ['Lubricating oil'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.47, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0022, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Coal', basis: 'embodied', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 2.5, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.0085, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Transport, truck, long-haul', basis: 'embodied', casNumber: null,
    aliases: ['Transport, truck, regional', 'Truck Transport'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.110, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.00047, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Transport, ocean freight', basis: 'embodied', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 0.012, unit: 'kg CO2 eq' },
    ] },

  { substanceName: 'Wastewater', basis: 'elementary', casNumber: null,
    aliases: ['Wastewater, industrial'],
    factors: [
      { impactCategory: 'Eutrophication', value: 0.44, unit: 'kg PO4 eq' },
      { impactCategory: 'Ecotoxicity', value: 0.90, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Solid Waste', basis: 'elementary', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Human Toxicity', value: 0.0055, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Refrigerant R-410A', basis: 'embodied', casNumber: null,
    aliases: ['R-410A'],
    factors: [
      { impactCategory: 'Global Warming', value: 2088.0, unit: 'kg CO2 eq' },
    ] },
];

export const TRACI_21_METHOD_NAME = 'TRACI 2.1';
