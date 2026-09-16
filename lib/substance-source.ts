// substance-source — derive the *source database* label for a substance/flow.
//
// The professor's recurring question on the demo call was "what database is
// that coming from?" — and the inspector never answered it. This helper maps
// the real fields we already have on every substance (its `category` and, when
// present, its `cas_number`) to the reference database that data is drawn from.
//
// Honesty notes:
//  - A CAS number is a PubChem-resolvable chemical identity, so when one is
//    present we cite it.
//  - The impact factors cite their own sources (driver_impact_factors
//    .source_reference: IAI, worldsteel, EPA WARM, EPA eGRID, Ember, US EPA
//    TRACI 2.1 via LCIAfmt, openLCA method files). The substances API returns
//    them as `data_source`, and that is the label. No database is ever guessed
//    from the category: this library holds no ecoinvent data, and a label
//    naming it would be a false attribution.

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

export function substanceSource(s: SubstanceLike): SubstanceSource {
  const cas = s.cas_number?.trim()
  // "N/A", dashes and all-zero numbers (00000-00-0) are placeholders, not identities.
  const identity =
    cas && !/^(n\/?a|none|-+|[0-]+)$/i.test(cas) ? `PubChem CAS ${cas}` : undefined

  // Explicit, authoritative source always wins.
  const explicit = s.data_source?.trim()
  if (explicit) {
    return {
      database: explicit,
      identity,
      label: identity ? `${explicit} · ${identity}` : explicit,
    }
  }

  // No recorded source: say so rather than name a database.
  const database = 'factor source not recorded'

  return {
    database,
    identity,
    label: identity ? `${database} · ${identity}` : database,
  }
}
