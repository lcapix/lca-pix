import { describe, it, expect } from 'vitest'

import {
  TIER_LABEL,
  applyButtonLabel,
  backHref,
  backLabel,
  confidenceColor,
  layerLabel,
  noFlowsMessage,
  percent,
  scoreColor,
  tierDepth,
} from '@/lib/import/display'

describe('TIER_LABEL / tierDepth', () => {
  it('labels every tier, with TASK for an elemental task', () => {
    expect(TIER_LABEL).toEqual({
      product: 'PRODUCT',
      machine_line: 'MACHINE/LINE',
      subprocess: 'SUBPROCESS',
      operation: 'OPERATION',
      elemental_task: 'TASK',
    })
  })

  it('indents product 0 through operation 3, and anything else (task, unknown) 4', () => {
    expect(['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'].map(tierDepth)).toEqual([
      0, 1, 2, 3, 4,
    ])
    expect(tierDepth('')).toBe(4)
    expect(tierDepth('line')).toBe(4)
  })
})

describe('layerLabel', () => {
  it('names a known layer and shows an unknown one as its id', () => {
    expect(layerLabel('skeleton')).toBe('Process hierarchy')
    expect(layerLabel('costs')).toBe('Costs')
    expect(layerLabel('weird')).toBe('weird')
  })
})

describe('scoreColor', () => {
  it('is success from 0.9, warn from 0.55, error below', () => {
    expect(scoreColor(1)).toBe('var(--signal-success, #16a34a)')
    expect(scoreColor(0.9)).toBe('var(--signal-success, #16a34a)')
    expect(scoreColor(0.89)).toBe('var(--signal-warn, #d97706)')
    expect(scoreColor(0.55)).toBe('var(--signal-warn, #d97706)')
    expect(scoreColor(0.54)).toBe('var(--signal-error, #dc2626)')
    expect(scoreColor(0)).toBe('var(--signal-error, #dc2626)')
  })
})

describe('confidenceColor', () => {
  it('is success from 0.8, warn from 0.5, tertiary text below', () => {
    expect(confidenceColor(1)).toBe('var(--signal-success, #16a34a)')
    expect(confidenceColor(0.8)).toBe('var(--signal-success, #16a34a)')
    expect(confidenceColor(0.79)).toBe('var(--signal-warn, #d97706)')
    expect(confidenceColor(0.5)).toBe('var(--signal-warn, #d97706)')
    expect(confidenceColor(0.4)).toBe('var(--text-tertiary)')
    expect(confidenceColor(0)).toBe('var(--text-tertiary)')
  })
})

describe('percent', () => {
  it('rounds a 0..1 score to a whole percent without the sign', () => {
    expect(percent(0.954)).toBe('95')
    expect(percent(0.955)).toBe('96')
    expect(percent(1)).toBe('100')
    expect(percent(0)).toBe('0')
  })
})

describe('applyButtonLabel', () => {
  it('reads by phase and by create vs append', () => {
    expect(applyButtonLabel(false, false)).toBe('Apply — create this case')
    expect(applyButtonLabel(false, true)).toBe('Apply — add to case')
    expect(applyButtonLabel(true, false)).toBe('Creating case…')
    expect(applyButtonLabel(true, true)).toBe('Adding…')
  })
})

describe('backHref / backLabel', () => {
  it('goes back to the target case when one is chosen, else to the project', () => {
    expect(backHref('3', 12)).toBe('/project/3/case/12')
    expect(backLabel(12)).toBe('Back to the case')
    expect(backHref('3', null)).toBe('/project/3')
    expect(backLabel(null)).toBe('Back to the project')
  })

  it('treats case id 0 as no case (truthy check)', () => {
    expect(backHref('3', 0)).toBe('/project/3')
    expect(backLabel(0)).toBe('Back to the project')
  })
})

describe('noFlowsMessage', () => {
  it('explains a routing has no flows, and says so plainly for other documents', () => {
    expect(noFlowsMessage('routing')).toMatch(/^A routing gives the steps and their hours/)
    expect(noFlowsMessage('bom')).toBe('This document has no material or energy lines to add.')
    expect(noFlowsMessage('itac')).toBe('This document has no material or energy lines to add.')
  })
})
