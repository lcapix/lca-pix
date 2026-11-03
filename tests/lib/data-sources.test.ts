import { describe, expect, it } from 'vitest'
import { groupFactorSources, shownSources, sourceState, type SourceStatus } from '@/lib/data-sources'

const base: SourceStatus = { id: 'eia', name: 'EIA', configured: false, staticBacked: true, status: 'static', events: 0, fails: 0, lastSync: null }

describe('G3 Data sources', () => {
  it('a source with no live key says Reference and names the vintage', () => {
    const s = sourceState(base, '2026-06')
    expect(s.word).toBe('Reference')
    expect(s.line).toContain('2026-06')
  })
  it('a live key that answered says Live; one that failed last says so', () => {
    expect(sourceState({ ...base, configured: true, status: 'success', events: 3 }, '2026-06').word).toBe('Live')
    expect(sourceState({ ...base, configured: true, status: 'error', events: 3, fails: 1 }, '2026-06').word).toBe('Last call failed')
    expect(sourceState({ ...base, configured: true, status: 'idle', events: 0 }, '2026-06').word).toBe('Ready')
    expect(sourceState({ ...base, configured: true, keyRequired: false, status: 'idle', events: 0 }, '2026-06').line).toBe('No key needed; not run yet on this server.')
  })
  it('Electricity Maps is not shown: no screen calls it', () => {
    const ids = shownSources([{ id: 'bls' }, { id: 'electricity_maps' }, { id: 'metals' }]).map((s) => s.id)
    expect(ids).toEqual(['bls', 'metals'])
  })
  it('groups factors by the dataset they cite, with blanks named', () => {
    const g = groupFactorSources([
      { source_reference: 'lciafmt TRACI 2.1 (US EPA, public domain)', n: 600 },
      { source_reference: 'EPA eGRID 2023 US national average (0.350 kg CO2e/kWh) [EGRID-2023]', n: 9 },
      { source_reference: 'Ember Global Electricity Review (2024 avg 473 gCO2/kWh) [EMBER-2024]', n: 6 },
      { source_reference: 'worldsteel 2022 global average crude steel', n: '15' },
      { source_reference: null, n: 4 },
      { source_reference: 'Some journal 2019', n: 2 },
      { source_reference: 'openLCA TRACI 2.1', n: 39 },
    ])
    expect(g).toEqual([
      { name: 'US EPA TRACI 2.1 (lciafmt)', factors: 600 },
      { name: 'openLCA (CML 2001, ReCiPe, TRACI)', factors: 39 },
      { name: 'worldsteel', factors: 15 },
      { name: 'EPA eGRID (US electricity)', factors: 9 },
      { name: 'Ember (Global and EU electricity)', factors: 6 },
      { name: 'No source on record', factors: 4 },
      { name: 'Other cited sources', factors: 2 },
    ])
  })
})
