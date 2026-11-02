/**
 * The Data sources screen (G3): where every number comes from, for everyone.
 * Pure: the status API's sources read as plain states, and each factor's
 * source_reference grouped under the dataset it cites.
 */

export interface SourceStatus {
  id: string
  name: string
  configured: boolean
  staticBacked: boolean
  status: 'success' | 'warn' | 'error' | 'idle' | 'static'
  events: number
  fails: number
  lastSync: string | null
}

/** What each source feeds in the app, in a student's words. Only sources a screen calls are listed. */
export const SOURCE_USE: Record<string, { feeds: string; where: string; side: 'cost' | 'library' }> = {
  bls: { feeds: 'Hourly wages by occupation and state', where: 'A step\'s labour cost: "Look up a labor rate"', side: 'cost' },
  eia: { feeds: 'Electricity and natural gas prices', where: 'A step\'s energy cost: "Look up the price"', side: 'cost' },
  metals: { feeds: 'Metal prices per kilogram', where: 'A step\'s material cost: the metal lookup', side: 'cost' },
  openlca: { feeds: 'Characterisation factors (CML 2001)', where: 'The factor library, loaded by an administrator', side: 'library' },
  pubchem: { feeds: 'Chemical formula, weight and name for substances', where: 'The substance library, enriched by an administrator', side: 'library' },
}

/** Electricity Maps has a route but no screen or job calls it, so it is not shown. */
export function shownSources<T extends { id: string }>(sources: T[]): T[] {
  return sources.filter((s) => s.id in SOURCE_USE)
}

/** One plain line for a source's state right now. */
export function sourceState(s: SourceStatus, vintage: string): { word: string; line: string; tag: 'regional' | 'reference' | 'global' } {
  if (!s.configured && s.staticBacked) {
    return { word: 'Reference', line: `No live key on this server, so the dated reference values (${vintage}) are used and tagged Reference.`, tag: 'reference' }
  }
  if (!s.configured) return { word: 'Not set up', line: 'This source is not set up on this server.', tag: 'global' }
  if (s.status === 'error') return { word: 'Last call failed', line: 'The last call failed; the dated reference values are used until it answers.', tag: 'reference' }
  if (s.events === 0) return { word: 'Ready', line: 'Live key set; not called yet on this server.', tag: 'regional' }
  return { word: 'Live', line: s.fails > 0 ? `Answering live (${s.fails} failed call${s.fails === 1 ? '' : 's'} on record).` : 'Answering live.', tag: 'regional' }
}

/** Known datasets, matched on the factor's cited source. Order matters: the first match wins. */
const DATASETS: Array<{ name: string; match: RegExp }> = [
  { name: 'US EPA TRACI 2.1 (lciafmt)', match: /lciafmt|traci/i },
  { name: 'EPA eGRID (US electricity)', match: /egrid/i },
  { name: 'Ember (Global and EU electricity)', match: /ember/i },
  { name: 'worldsteel', match: /worldsteel/i },
  { name: 'openLCA (CML 2001, ReCiPe)', match: /openlca/i },
  { name: 'IPCC', match: /ipcc/i },
  { name: 'Entered by hand', match: /hand|own number|user|custom/i },
]

/** Factor counts per cited dataset; anything not matched is "Other cited sources", a blank source "No source on record". */
export function groupFactorSources(rows: Array<{ source_reference: string | null; n: number | string }>): Array<{ name: string; factors: number }> {
  const out = new Map<string, number>()
  for (const r of rows) {
    const ref = String(r.source_reference ?? '').trim()
    const name = ref ? DATASETS.find((d) => d.match.test(ref))?.name ?? 'Other cited sources' : 'No source on record'
    out.set(name, (out.get(name) ?? 0) + Number(r.n))
  }
  return [...out.entries()].map(([name, factors]) => ({ name, factors })).sort((a, b) => b.factors - a.factors)
}
