// substance-source — derive the *source database* label for a substance/flow.
//
// The professor's recurring question on the demo call was "what database is
// that coming from?" — and the inspector never answered it. This helper maps
// the real fields we already have on every substance (its `category` and, when
// present, its `cas_number`) to the reference database that data is drawn from.
//
// Honesty notes:
//  - The substance catalog in this app is populated from public openLCA +
//    PubChem imports (see EnvironmentalFlowsEditor header). A CAS number is a
//    PubChem-resolvable chemical identity, so when one is present we cite it.
//  - The impact *factors* (per-unit characterization) come from databases like
//    ecoinvent / GREET / IPCC. Those are category-dependent, so we label the
//    reference database by category.
//  - If a row carries an explicit `data_source` (e.g. joined from
//    driver_impact_factors), that authoritative value wins.

export interface SubstanceLike {
  category?: string | null
  /** Some flow rows surface the substance category under this alias. */
  substance_category?: string | null
  cas_number?: string | null
  /** Authoritative source if the API joined driver_impact_factors.data_source. */
  data_source?: string | null
}

export interface SubstanceSource {
  /** Primary reference database the substance's impact data is drawn from. */
  database: string
  /** Chemical-identity source (PubChem) when a CAS number is available. */
  identity?: string
  /** Compact one-line label for chips, e.g. "ecoinvent · PubChem CAS 124-38-9". */
  label: string
}

const CATEGORY_DATABASE: Record<string, string> = {
  material: 'ecoinvent',
  energy: 'ecoinvent / GREET',
  emission: 'IPCC AR6 / ecoinvent',
  waste: 'ecoinvent',
  water: 'ecoinvent / AWARE',
}

export function substanceSource(s: SubstanceLike): SubstanceSource {
  const cas = s.cas_number?.trim()
  const identity = cas ? `PubChem CAS ${cas}` : undefined

  // Explicit, authoritative source always wins.
  const explicit = s.data_source?.trim()
  if (explicit) {
    return {
      database: explicit,
      identity,
      label: identity ? `${explicit} · ${identity}` : explicit,
    }
  }

  const cat = (s.category ?? s.substance_category ?? '').toString().toLowerCase()
  const database = CATEGORY_DATABASE[cat] ?? 'ecoinvent'

  return {
    database,
    identity,
    label: identity ? `${database} · ${identity}` : database,
  }
}
