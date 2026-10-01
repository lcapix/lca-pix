// Palettes and fixed values of the analytics page.

import type { CostBreakdown } from './types'

/** Series (case) colours of the category charts, cycled by series index. */
export const SERIES_COLORS = ['#2d6a4f', '#74c69d', '#d98568', '#9f88cc', '#4f90c9']

/** Component colours of the component-contribution chart, cycled by component index. */
export const COMPONENT_COLORS = [
  '#2d6a4f',
  '#52796f',
  '#84a98c',
  '#d98568',
  '#f0a68a',
  '#f5c971',
  '#9f88cc',
  '#4f90c9',
]

/** Zeroed costs in USD: the starting point of every case's cost sum. */
export const EMPTY_COSTS: CostBreakdown = {
  total: 0,
  labor: 0,
  energy: 0,
  material: 0,
  transport: 0,
  equipment: 0,
  overhead: 0,
  opex: 0,
  capex: 0,
  currency: 'USD',
}

/** Colour of each cost type in the stacked cost-breakdown chart. */
export const COST_COLORS: Record<string, string> = {
  Labor: '#2d6a4f',
  Energy: '#d98568',
  Material: '#4f90c9',
  Transport: '#9f88cc',
  Equipment: '#c9a44f',
  Overhead: '#8a8f98',
}

/** Cost types of the stacked cost-breakdown chart, in stacking order. */
export const COST_TYPES = ['Labor', 'Energy', 'Material', 'Transport', 'Equipment', 'Overhead'] as const

/** Matches the climate-change category, whatever the LCIA method calls it. */
export const GWP_CATEGORY_PATTERN = /global warming|climate/i
