/**
 * Utility functions for formatting data display
 */

/**
 * Format chemical formulas with proper Unicode subscripts
 * Transforms common chemical notation to display-ready format
 *
 * @param text - The text containing chemical formulas
 * @returns Formatted text with proper subscripts
 *
 * @example
 * formatChemicalUnit("kg CO2-eq") // Returns "kg CO₂-eq"
 * formatChemicalUnit("kg SO2-eq") // Returns "kg SO₂-eq"
 */
export function formatChemicalUnit(text: string): string {
  if (!text) return text

  return text
    // Carbon dioxide
    .replace(/CO2/gi, 'CO₂')
    // Sulfur dioxide
    .replace(/SO2/gi, 'SO₂')
    // Phosphate
    .replace(/PO4/gi, 'PO₄')
    // Nitrogen oxides
    .replace(/NOx/gi, 'NOₓ')
    // Methane (less common, but good to have)
    .replace(/CH4/gi, 'CH₄')
    // Nitrous oxide
    .replace(/N2O/gi, 'N₂O')
}

/**
 * Format large numbers with appropriate units (K, M, B)
 *
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with unit suffix
 *
 * @example
 * formatLargeNumber(1500) // Returns "1.50K"
 * formatLargeNumber(2500000) // Returns "2.50M"
 */
export function formatLargeNumber(value: number, decimals: number = 2): string {
  if (value === 0) return '0'

  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(decimals)}B`
  } else if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(decimals)}M`
  } else if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(decimals)}K`
  }

  return value.toFixed(decimals)
}

/**
 * Format currency with appropriate symbol and decimals
 *
 * @param value - The numeric value
 * @param currency - Currency code (default: 'USD')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  decimals: number = 2
): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  }

  const symbol = symbols[currency] || currency
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`
}
