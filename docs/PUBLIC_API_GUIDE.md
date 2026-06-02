# LCAPIX v3 — Public-API Integration Guide

How each external data source plugs into the app, where the user touches it, and whether it actually works today.

**Audit date:** June 2, 2026 against Vercel production.

---

## Quick status table

| API | Purpose | UI surface | Server route | API key needed | Working? |
|---|---|---|---|---|---|
| **BLS OEWS** | US labor wages by occupation | Component form → "Suggest costs (Labor)" | `POST /api/integrations/bls/fetch-wage` | No (BLS is free) | 🟡 Returns annual wage, treated as hourly — calc bug |
| **EIA** | US energy prices (electricity, gas) | Component form → "Suggest costs (Energy)" | `POST /api/integrations/eia/fetch-energy-price` | Yes — `EIA_API_KEY` | 🔴 Field mismatch — UI sends `region`, API needs `state` |
| **Metals-API** | Daily commodity prices (steel, alu, cu, …) | Component form → "Suggest costs (Material)" | `POST /api/integrations/metals/fetch-price` | Yes — `METALS_API_KEY` | 🔴 Symbol mismatch — UI sends `steel`, API needs `STL` |
| **PubChem** | Substance enrichment (CAS, formula, hazard) | Admin → Integrations → "Enrich substances" button | `POST /api/integrations/pubchem/enrich` | No | ✅ Works |
| **openLCA factor pack** | Characterization factors for CML / ReCiPe / TRACI | Admin → Integrations → "Import {method}" buttons | `POST /api/integrations/openlca/import` | No (data bundled) | ✅ Works |
| **Electricity Maps** | Live grid carbon intensity by zone | (none — server-side sync only) | `POST /api/integrations/electricity/sync` | Yes — `ELECTRICITY_MAPS_API_KEY` | 🔴 No UI; returns generic "Invalid body" |

Three integrations are broken end-to-end. The cost-suggestion button is the user-facing feature that depends on three of them — so the "Suggest costs" feel is **non-functional** today.

---

## 1. BLS OEWS — labor wages

### What it does
Looks up the mean wage for a given US occupation (SOC code) in a given state. Used to auto-fill labor cost on a component.

### How a user triggers it
1. Open any component in the editor
2. In the cost form, toggle on **Labor**
3. Click **Suggest**

The UI then calls the BLS endpoint with the welder occupation by default (SOC `51-4121`) and the case's region. Returned wage × 0.5 hours × quantity becomes the labor cost line.

### Live test

```bash
curl -s -X POST https://lca-project-v3.vercel.app/api/integrations/bls/fetch-wage \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"occupation":"51-4121","state":"NC"}'
```

Returns:
```json
{
  "success": true,
  "rate": {
    "rateValue": 53720,
    "unit": "$/hr",
    "source": "BLS OEWS 2025",
    "effectiveDate": "2025-05-01"
  }
}
```

### The bug
**`53720` is the BLS annual mean wage**, not hourly. The `unit: "$/hr"` label is incorrect. When the UI does `53720 × 0.5 × quantity`, you get ~$26,860 per unit of labor — inflated ~100× over the truth.

### Fix
Either:
- Server side: divide by 2080 (annual hours) before returning: `rateValue: 25.83, unit: "$/hr"`
- Client side: detect if `rateValue > 1000` and treat as annual; divide by 2080 before multiplying

---

## 2. EIA — energy prices

### What it does
Fetches the average retail electricity (or other fuel) price per kWh for a state. Used to auto-fill energy cost.

### How a user triggers it
Component form → toggle **Energy** → click **Suggest**.

### Live test

```bash
curl -s -X POST https://lca-project-v3.vercel.app/api/integrations/eia/fetch-energy-price \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fuel":"electricity","region":"NC"}'
```

Returns:
```json
{
  "error": "Invalid body",
  "issues": [{"path":["state"],"message":"Required"}]
}
```

### The bug
The route's zod schema requires `state`, but the UI's `suggest()` function (in `components/component-form/component-form.tsx` line 1083) sends `region`.

### Fix
Pick one name. Recommended: change the API to accept `region` (matches the form field name elsewhere in the codebase).

---

## 3. Metals-API — commodity prices

### What it does
Daily spot price per kg for industrial metals.

### How a user triggers it
Component form → toggle **Material** → click **Suggest**.

### Live test

```bash
curl -s -X POST https://lca-project-v3.vercel.app/api/integrations/metals/fetch-price \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"symbol":"steel"}'
```

Returns:
```json
{"error": "Invalid symbol. Supported: ALU, XCU, ZNC, NIK, LEA, TIN, STL"}
```

### The bug
UI sends lowercase common name (`steel`), API expects 3-letter ISO-style code (`STL`).

### Fix
Map common names → API codes in the UI. Suggested map:

```ts
const METALS_SYMBOL = {
  steel: 'STL', aluminum: 'ALU', copper: 'XCU',
  zinc: 'ZNC', nickel: 'NIK', lead: 'LEA', tin: 'TIN',
}
```

Then send `METALS_SYMBOL[material] ?? material.toUpperCase()`.

---

## 4. PubChem — substance enrichment

### What it does
For every substance in the DB without a PubChem CID, look up the CAS number against PubChem and pull `pubchem_cid`, `iupac_name`, `molecular_formula`, `hazard_classification`, `molecular_weight`.

### How a user triggers it
**Admin only.** Visit `/admin/integrations` → "PubChem" card → click "Enrich substances".

### Live test

```bash
curl -s -X POST https://lca-project-v3.vercel.app/api/integrations/pubchem/enrich \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"only_missing":true}'
```

Returns:
```json
{"success": true, "summary": {"enriched": 7, "notFound": 34, "failed": 0, "total": 41}}
```

### Status
✅ **Works.** Out of 41 substances, 7 were successfully enriched. The 34 not-found cases are mostly LCA process-style substances ("Aluminum alloy, economical") that aren't 1:1 with PubChem compound records.

### Idea
Surface this in the component-form too. When a user types a new substance name, fire off a PubChem lookup in the background; pre-fill formula / hazard.

---

## 5. openLCA — characterization factor import

### What it does
Imports the CML 2001, ReCiPe Midpoint (H), or TRACI 2.1 factor pack into the `driver_impact_factors` table. The pack is **bundled in the repo** at `lib/integrations/openlca/data/`, so no network call.

### How a user triggers it
Admin only. `/admin/integrations` → openLCA card → "Import CML 2001" (and ReCiPe, TRACI).

### Live test

```bash
curl -s -X POST https://lca-project-v3.vercel.app/api/integrations/openlca/import \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"method":"CML 2001"}'
```

Returns:
```json
{
  "success": true,
  "result": {
    "method": "CML 2001",
    "inserted": 48,
    "substancesMatched": 24,
    "skippedNoSubstance": 0,
    "skippedNoCategory": 0,
    "errors": []
  }
}
```

### Status
✅ **Works.** Run this once after setting up the DB to populate the factor pack. Idempotent — re-running won't duplicate rows (uses INSERT … ON CONFLICT).

---

## 6. Electricity Maps — grid carbon

### What it does (intent)
Per-zone live or daily carbon intensity (gCO₂/kWh) for the electrical grid. The Painted Metal Box scenario uses NC's `US-CAR-DUK` zone.

### How a user triggers it today
**Not surfaced in the UI.** There is a server route `/api/integrations/electricity/sync` that an admin can call manually, but no button anywhere triggers it. The component form doesn't have a "fetch grid carbon" toggle.

### Live test

```bash
curl -s -X POST https://lca-project-v3.vercel.app/api/integrations/electricity/sync \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"zone":"US-CAR-DUK"}'
```

Returns:
```json
{"error": "Invalid body"}
```

### The bugs
1. Generic `"Invalid body"` with no details — the zod schema check should emit `issues[]` like EIA does.
2. **No UI integration** — even if the sync worked, no user-facing feature consumes its output. The bundled CML 2001 factor for electricity has a fixed value; the Electricity Maps live data isn't applied to the calculation.

### Fix path
1. Add `console.log` of the zod issue in the 400 response so the API tells you what it wants.
2. Add a "Live grid intensity" toggle on the component form: when on, the energy cost calculation uses `liveIntensity × kwh` instead of the static factor.
3. Show the user the live value (e.g., "NC grid right now: 412 gCO₂/kWh — Electricity Maps").

---

## Where these are wired in the code

| File | What |
|---|---|
| `lib/integrations/bls/client.ts` | BLS client |
| `lib/integrations/eia/client.ts` | EIA client |
| `lib/integrations/electricity-maps/{client,sync}.ts` | Electricity Maps |
| `lib/integrations/metals/client.ts` | Metals-API client |
| `lib/integrations/openlca/{import,data/*.ts}` | openLCA factor pack |
| `lib/integrations/pubchem/{client,enrich}.ts` | PubChem |
| `components/component-form/component-form.tsx` line ~1049 — `suggest()` | The "Suggest costs" button calls BLS+EIA+Metals |
| `components/integrations/import-buttons.tsx` | Admin batch-import buttons |
| `app/admin/integrations/page.tsx` | The Integrations dashboard |

---

## Recommended order of fixes

1. **BUG #2 (flow creation)** — fixes the whole app, not just integrations
2. **EIA field name** — one-line fix, restores 1/3 of Suggest button
3. **Metals symbol mapping** — UI-only change, restores another 1/3
4. **BLS hourly/annual** — server normalization, restores the last 1/3 and stops the 100× cost inflation
5. **Electricity Maps**: add UI wiring + emit zod errors

Once those land, the "Suggest costs" feature actually works end-to-end and the live grid intensity feature becomes available for the form.
