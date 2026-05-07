/**
 * Central Color Configuration for Component Hierarchy
 *
 * Based on design specification with standby and selected states
 * for all component types in the process hierarchy.
 */

export type ComponentType =
  | 'product'
  | 'machine_line'
  | 'subprocess'
  | 'operation'
  | 'elemental_task'

export type ColorState = 'standby' | 'selected'

export interface ColorConfig {
  bg: string
  border: string
  text: string
}

export interface ComponentColors {
  standby: ColorConfig
  selected: ColorConfig
}

/**
 * Helper function to darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace('#', '')

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Darken by percentage
  const darkR = Math.floor(r * (1 - percent / 100))
  const darkG = Math.floor(g * (1 - percent / 100))
  const darkB = Math.floor(b * (1 - percent / 100))

  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(darkR)}${toHex(darkG)}${toHex(darkB)}`
}

/**
 * Helper function to determine text color based on background brightness
 */
function getTextColor(bgHex: string): string {
  // Remove # if present
  bgHex = bgHex.replace('#', '')

  // Parse RGB values
  const r = parseInt(bgHex.substring(0, 2), 16)
  const g = parseInt(bgHex.substring(2, 4), 16)
  const b = parseInt(bgHex.substring(4, 6), 16)

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return white for dark backgrounds, dark gray for light backgrounds
  return luminance > 0.6 ? '#1F2937' : '#FFFFFF'
}

/**
 * Create color configuration from background hex code
 */
function createColorConfig(bgHex: string): ColorConfig {
  return {
    bg: bgHex,
    border: darkenColor(bgHex, 20), // 20% darker for border
    text: getTextColor(bgHex)
  }
}

/**
 * Component Hierarchy Color Configuration
 *
 * Colors based on design specification:
 * - Product: Standby #E95635, Selected #ED8679
 * - Machine/Line: Standby #ED8A7A, Selected #FFB630
 * - Subprocess: Standby #FFDA3C, Selected #FFDA3C
 * - Operation: Standby #40CFFD, Selected #4197F7
 * - Elemental Task: Standby #C4B5FD, Selected #C4B5FD
 */
export const HIERARCHY_COLORS: Record<ComponentType, ComponentColors> = {
  product: {
    standby: createColorConfig('#E95635'),
    selected: createColorConfig('#ED8679')
  },
  machine_line: {
    standby: createColorConfig('#ED8A7A'),
    selected: createColorConfig('#FFB630')
  },
  subprocess: {
    standby: createColorConfig('#FFDA3C'),
    selected: createColorConfig('#FFDA3C')
  },
  operation: {
    standby: createColorConfig('#40CFFD'),
    selected: createColorConfig('#4197F7')
  },
  elemental_task: {
    standby: createColorConfig('#C4B5FD'),
    selected: createColorConfig('#C4B5FD')
  }
}

/**
 * Get colors for a specific component type and state
 */
export function getColorsByComponentType(
  type: ComponentType,
  state: ColorState = 'standby'
): ColorConfig {
  return HIERARCHY_COLORS[type][state]
}

/**
 * Map process_type string to ComponentType
 */
export function normalizeComponentType(processType: string): ComponentType {
  const normalized = processType.toLowerCase().replace(/\s+/g, '_')

  if (normalized.includes('product')) return 'product'
  if (normalized.includes('machine') || normalized.includes('line')) return 'machine_line'
  if (normalized.includes('subprocess')) return 'subprocess'
  if (normalized.includes('operation')) return 'operation'
  if (normalized.includes('elemental') || normalized.includes('task')) return 'elemental_task'

  // Default to product if unknown
  return 'product'
}

/**
 * Legacy function for level-based color lookup (deprecated)
 * Use getColorsByComponentType instead
 */
export function getColorsByLevel(level: number): ColorConfig {
  const types: ComponentType[] = ['product', 'machine_line', 'subprocess', 'operation', 'elemental_task']
  const type = types[Math.min(level, 4)]
  return getColorsByComponentType(type, 'standby')
}
