# LCAPIX v3 — API Integration Design

**Date:** 2026-04-13
**Status:** Approved for implementation
**Owner:** Kavish Pandit
**Context:** Making v3 production-ready by connecting to public data sources for both environmental impact factors and cost factors.

---

## Problem Statement

LCAPIX v3 has the correct architecture (5-tier process hierarchy, flows, characterization factors, assessment engine, cost fields) but lacks real-world data:

- **42 substances** in the catalog — 27 have no category and no characterization factors
- **37 characterization factors** — most substances cover only 1–4 of 8 impact categories
- **1 valuation method** (CML 2001) — v1 supported multiple (CML, EPS, TRACI, Tellus)
- **No cost data sources** — cost fields exist on components but there is no way to populate them automatically
- **Static electricity factor** — not location-aware (France vs US vs India differ 13x)

Without these inputs, calculations silently skip substances that have no factors. Results look clean but are dramatically incomplete. This matches Gary's feedback that v3 is "not robust enough."

---

## Goals

1. Every substance has complete characterization factor coverage across all 8+ impact categories.
2. Users can choose between multiple valuation methods (CML, ReCiPe, TRACI, EPS, etc.).
3. Cost fields auto-populate from authoritative data sources (labor, energy, materials).
4. Calculations reflect factory location (energy carbon and energy cost both vary by region).
5. No silent data loss — every flow contributes to every impact category.
6. The integration is transparent: every number stored includes its source.

## Non-Goals (for this phase)

- ECP Library (Phase 2, requires Gary's process knowledge).
- Combined cost-environmental trade-off reports (Phase 3).
- Driver factor workflow / Determination UI (Phase 4).
- ecoinvent integration (paid, deferred).

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     EXTERNAL DATA SOURCES                     │
├──────────────────────────────────────────────────────────────┤
│  ENVIRONMENTAL                  COST                          │
│  ─────────────                  ────                          │
│  openLCA LCIA Pack (FREE)       BLS API (FREE)               │
│    → characterization factors     → labor $/hr by occupation │
│    → 8 valuation methods          → by US state              │
│                                                               │
│  PubChem PUG REST (FREE)        EIA API (FREE w/ key)        │
│    → CAS numbers                  → electricity $/kWh by state│
│    → molecular formulas           → natural gas $/MCF         │
│    → categorization                                          │
│                                                               │
│  Electricity Maps (FREE tier)   Metals-API (FREE tier)        │
│    → grid carbon by zone          → commodity metal prices    │
└──────────────────────────────────────────────────────────────┘
            │                                │
            ▼                                ▼
┌──────────────────────────────────────────────────────────────┐
│            INTEGRATION LAYER (Next.js API routes)             │
│                                                               │
│  /api/integrations/openlca/      Import factor bundles       │
│  /api/integrations/pubchem/      Enrich substance records    │
│  /api/integrations/electricity/  Live grid carbon + price    │
│  /api/integrations/bls/          Fetch labor rates           │
│  /api/integrations/eia/          Fetch energy prices         │
│  /api/integrations/metals/       Fetch commodity prices      │
└──────────────────────────────────────────────────────────────┘
            │                                │
            ▼                                ▼
┌──────────────────────────────────────────────────────────────┐
│                      AWS RDS MySQL (v3)                       │
│                                                               │
│  substances  (enriched with CAS, formula, pubchem_cid)       │
│  driver_impact_factors  (5,000+ factors, method_name col)    │
│  cost_rates  (NEW: labor/energy/material rate cache)         │
│  integration_log  (NEW: audit trail for every import)        │
└──────────────────────────────────────────────────────────────┘
```

---

## API Inventory

### Environmental APIs

| API | Type | Cost | What It Provides | Volume |
|-----|------|------|-------------------|--------|
| [openLCA LCIA Pack](https://nexus.openlca.org/database/openLCA%20LCIA%20Methods) | JSON-LD download | Free | 8 valuation methods with characterization factors | ~5,000 factors |
| [PubChem PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest) | Live REST API | Free, no key | Chemical identifiers (CAS), formulas, GHS hazards | 111M compounds |
| [Electricity Maps](https://www.electricitymaps.com/free-tier-api) | Live REST API | Free tier (1 zone) | gCO₂-eq/kWh by region | 200+ zones |

### Cost APIs

| API | Type | Cost | What It Provides | Volume |
|-----|------|------|-------------------|--------|
| [BLS Public Data API](https://www.bls.gov/developers/) | Live REST API | Free (key for v2) | Wages by occupation + state | 830 occupations |
| [EIA Open Data API](https://www.eia.gov/opendata/) | Live REST API | Free with key | Electricity + gas prices | All US states |
| [Metals-API](https://metals-api.com/) | Live REST API | Free tier (100/mo) | Commodity metal prices | 20+ metals |

---

## Database Schema Changes

### 1. Extend `driver_impact_factors`

```sql
ALTER TABLE driver_impact_factors
  ADD COLUMN method_name VARCHAR(100) NOT NULL DEFAULT 'CML 2001' AFTER category_id;

CREATE INDEX idx_method_category ON driver_impact_factors(method_name, category_id);
```

Purpose: Store factors from multiple valuation methods side-by-side. Engine queries by method.

### 2. Extend `substances`

```sql
ALTER TABLE substances
  ADD COLUMN molecular_formula VARCHAR(100) NULL AFTER cas_number,
  ADD COLUMN molecular_weight DECIMAL(12,4) NULL AFTER molecular_formula,
  ADD COLUMN pubchem_cid INT NULL AFTER molecular_weight,
  ADD COLUMN hazard_classification TEXT NULL AFTER pubchem_cid,
  ADD COLUMN iupac_name VARCHAR(500) NULL AFTER hazard_classification,
  ADD COLUMN enriched_at TIMESTAMP NULL AFTER iupac_name;

CREATE INDEX idx_pubchem_cid ON substances(pubchem_cid);
```

Purpose: Store standardized chemical identity from PubChem, letting us cross-reference substances across databases.

### 3. New table `cost_rates`

```sql
CREATE TABLE cost_rates (
  rate_id INT AUTO_INCREMENT PRIMARY KEY,
  rate_type ENUM('labor','electricity','natural_gas','material','transport') NOT NULL,
  rate_key VARCHAR(200) NOT NULL COMMENT 'e.g. "Welder", "Electricity", "Steel"',
  region_code VARCHAR(20) NOT NULL COMMENT 'US state code, country code',
  rate_value DECIMAL(15,4) NOT NULL,
  rate_unit VARCHAR(50) NOT NULL COMMENT '$/hr, $/kWh, $/kg',
  effective_date DATE NOT NULL,
  source VARCHAR(100) NOT NULL COMMENT 'bls, eia, metals-api, user_override',
  source_series_id VARCHAR(100) NULL COMMENT 'BLS/EIA series identifier',
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_rate (rate_type, rate_key, region_code, effective_date),
  INDEX idx_type_region (rate_type, region_code),
  INDEX idx_effective (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Purpose: Cache rate data from APIs so we do not re-fetch on every calculation. Also keeps history for audit.

### 4. New table `integration_log`

```sql
CREATE TABLE integration_log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(50) NOT NULL COMMENT 'openlca, pubchem, electricity_maps, bls, eia, metals',
  action VARCHAR(100) NOT NULL COMMENT 'import_method, enrich_substance, fetch_rate',
  records_affected INT DEFAULT 0,
  executed_by INT NULL REFERENCES account(id),
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success','partial','failed') NOT NULL DEFAULT 'success',
  details JSON NULL COMMENT 'request params, row counts, error messages',
  INDEX idx_source_time (source, executed_at)
) ENGINE=InnoDB;
```

Purpose: Audit trail for every integration call. Required for data-quality claims in LCA reports.

### 5. Extend `assessment_runs`

```sql
ALTER TABLE assessment_runs
  ADD COLUMN region_code VARCHAR(20) NULL AFTER calculation_method COMMENT 'US-NY, FR, DE';
```

Purpose: Record which region was used for location-aware factors and rates.

---

## API Endpoints

### Environmental integration endpoints

```
POST   /api/integrations/openlca/import
         Body: { method: "CML 2001" | "ReCiPe Midpoint (H)" | "TRACI 2.1" | ... }
         Downloads JSON-LD bundle, parses, bulk-inserts factors.
         Returns: { imported: 4827, skipped: 12, method: "CML 2001" }

GET    /api/integrations/openlca/methods
         Lists available methods and their status (imported / not imported).

POST   /api/integrations/pubchem/enrich
         Body: { substance_ids?: [1,2,3] }  (omit to enrich all)
         Fetches CAS, formula, MW, hazards. Updates substances.
         Returns: { enriched: 42, failed: 3, skipped: 0 }

POST   /api/integrations/pubchem/search
         Body: { query: "polyethylene" }
         Returns: [{ cid, name, cas, formula }, ...]  for user to pick.

GET    /api/integrations/electricity/carbon?zone=US-NY
         Fetches live grid carbon intensity.
         Returns: { zone, carbonIntensity_gCO2eq_per_kWh, updatedAt }

POST   /api/integrations/electricity/sync-factors
         Body: { zones: ["US-NY","FR","DE"] }
         Writes each zone as a separate row in driver_impact_factors
         (geographic_scope = zone, method_name = user-selected).
```

### Cost integration endpoints

```
GET    /api/integrations/bls/occupations
         Returns list of occupations with their BLS series IDs.

POST   /api/integrations/bls/fetch-wage
         Body: { occupation: "51-4121", state: "NY" }
         Fetches latest median hourly wage.
         Caches in cost_rates table.
         Returns: { rate: 28.15, unit: "$/hr", effective_date: "2024-05" }

POST   /api/integrations/eia/fetch-energy-price
         Body: { fuel: "electricity"|"natural_gas", state: "NY", sector: "industrial" }
         Returns: { rate: 0.128, unit: "$/kWh", effective_date: "2026-01" }

POST   /api/integrations/metals/fetch-price
         Body: { symbol: "ALU" | "XCU" | "STEEL_HR" }
         Returns: { rate: 2.45, unit: "$/kg", effective_date: "2026-04-13" }
```

### Admin / management endpoints

```
GET    /api/integrations/status
         Returns data coverage dashboard:
         { substances_enriched: 42/42, factors_by_method: {...},
           rates_cached: { labor: 42, energy: 50, metals: 8 } }

GET    /api/integrations/log?source=openlca&limit=20
         Returns paginated integration_log records.
```

---

## LCA Engine Changes

The engine gets two new optional parameters:

```typescript
calculateCaseImpacts(
  caseId: number,
  connection: Connection,
  options: {
    method?: string;        // 'CML 2001' | 'ReCiPe Midpoint (H)' | ...
    regionCode?: string;    // 'US-NY' | 'FR' | 'Global'
  } = {}
): Promise<LCAResult>
```

### Query changes

```sql
-- OLD (implicit single method)
INNER JOIN driver_impact_factors dif
  ON f.substance_id = dif.substance_id

-- NEW (method-scoped, region-fallback)
INNER JOIN driver_impact_factors dif
  ON f.substance_id = dif.substance_id
  AND dif.method_name = ?   -- user-selected method
  AND (dif.geographic_scope = ?    -- exact region
       OR dif.geographic_scope = 'Global'  -- fallback
       OR dif.geographic_scope = 'Global')
ORDER BY CASE dif.geographic_scope
           WHEN ? THEN 1
           WHEN 'Global' THEN 2
           ELSE 3
         END
```

The region matching uses the user-selected region first, falling back to Global if the region-specific factor does not exist.

### Cost auto-population

When a user creates an elemental task with a region set on the case:

```typescript
async function autoPopulateCosts(component, regionCode) {
  // Labor: if task.occupation set, fetch from BLS
  if (component.occupation_code) {
    const rate = await getCachedOrFetch('labor', component.occupation_code, regionCode);
    component.labor_cost = rate.rate_value * component.labor_hours;
  }

  // Energy: for each electricity / natural gas flow, fetch price
  for (const flow of component.flows) {
    if (flow.substance === 'Electricity') {
      const rate = await getCachedOrFetch('electricity', 'grid', regionCode);
      component.energy_cost += rate.rate_value * flow.quantity;
    }
  }

  // Materials: for each metal flow, fetch commodity price
  for (const flow of component.flows) {
    if (METAL_SYMBOLS.includes(flow.substance)) {
      const rate = await getCachedOrFetch('material', flow.substance, 'Global');
      component.material_cost += rate.rate_value * flow.quantity;
    }
  }
}
```

---

## UX Changes

### New screens

1. **Integration Dashboard (admin)**
   - `/admin/integrations`
   - Shows coverage stats (substances enriched, factors by method, rates cached)
   - Buttons: "Import openLCA CML 2001", "Enrich all substances", "Refresh energy prices"
   - Log viewer for integration_log table.

2. **Method + Region selector on assessment run**
   - Modal before clicking "Run Assessment"
   - Dropdown: Valuation Method (CML, ReCiPe, TRACI, ...)
   - Dropdown: Region (US-NY, FR, DE, Global)
   - Shows expected data coverage before running.

3. **Substance picker with PubChem search**
   - When creating a flow, "Search PubChem" button.
   - Modal searches PubChem, user picks a compound.
   - Auto-creates substance record with CAS, formula, etc.

4. **Cost detail panel on components**
   - Currently shows raw cost fields.
   - After integration: shows "Labor: $12.50 (BLS, Welder in NY, May 2024)"
   - Source attribution visible next to every number.

### Existing screen updates

- **Assessment results page** — add source badges next to each factor.
- **PDF report** — include which method + region + data-source list at the end.

---

## Data Flow: Running an Assessment (after integration)

```
User opens case → picks method: "ReCiPe Midpoint (H)", region: "US-NY"
       │
       ▼
Engine fetches flows for elemental tasks
       │
       ▼
For each flow, JOIN driver_impact_factors
  WHERE method_name = "ReCiPe Midpoint (H)"
    AND (geographic_scope = "US-NY" OR "Global")
  ORDER BY exact-match first, Global fallback
       │
       ▼
For each elemental task, compute cost:
  - Labor: lookup cost_rates WHERE type='labor' AND rate_key=occupation AND region='US-NY'
  - Energy: lookup cost_rates WHERE type='electricity' AND region='US-NY'
  - Material: lookup cost_rates WHERE type='material' AND rate_key=metal
  - Anything missing → user input fallback
       │
       ▼
Aggregate: environmental impacts + cost by category
       │
       ▼
Store in assessment_results + assessment_runs
       │
       ▼
Render to UI with source badges + PDF with full attribution
```

---

## Error Handling

| Failure | Response |
|--------|----------|
| openLCA download fails | Surface error in integration_log, keep existing factors |
| PubChem 429 (rate limit) | Exponential backoff, batch of 5 req/s max |
| PubChem compound not found | Keep substance uncategorized, mark `enriched_at = now` with note |
| Electricity Maps API down | Fall back to last cached value for that zone |
| BLS / EIA API down | Use most recent `cost_rates` row for that key/region |
| No factor for substance+method+region | Skip flow silently BUT surface in `assessment_runs.notes` |
| Cost rate missing | Leave cost field null, show "No rate available" in UI |

All failures go to `integration_log` with `status = 'failed'` or `partial`.

---

## Testing Plan

- **Unit tests** for each integration client (openLCA parser, PubChem client, BLS client, etc.)
- **Integration tests** against live APIs (tagged `@external`, not in CI by default)
- **Golden-data tests** for the LCA engine: given known flows + factors, verify math
- **Schema migration tests** verifying idempotency (run twice, no errors)
- **End-to-end test** on EV Battery project: before integration vs after — assert result difference matches expectations

---

## Phased Rollout

**Phase 1a (this design):**
- Schema migrations.
- openLCA importer for CML 2001 only.
- PubChem substance enrichment.
- Integration dashboard UI.

**Phase 1b:**
- Electricity Maps integration.
- BLS + EIA cost integrations.
- Method + region selector in assessment run.
- Region-aware engine query changes.

**Phase 1c:**
- Metals-API material pricing.
- Additional openLCA methods (ReCiPe, TRACI, EPS).
- Source attribution in PDF report.

**Phase 2 (future):**
- ECP Library (requires Gary's input, separate design).

---

## Open Questions / Decisions Needed

1. **BLS API v2 key** — register a free key for higher limits?
2. **Electricity Maps zone** — single zone (US-NY) or multiple for the free tier limit?
3. **Metals-API free tier** (100 req/month) — sufficient for now, paid later?
4. **Cache TTL for cost_rates** — monthly refresh seems appropriate for labor/energy; daily for commodity metals.

---

## Success Criteria

- All 42 existing substances have CAS numbers and complete categorization.
- At least 3 valuation methods (CML, ReCiPe, TRACI) fully imported.
- Running the EV Battery assessment with region="US-NY" gives a different result from region="FR".
- Labor cost auto-populates when occupation + region are specified.
- Energy cost auto-populates from region.
- PDF report cites data sources for every number.
- Integration dashboard shows 100% coverage for the 2 demo projects.
