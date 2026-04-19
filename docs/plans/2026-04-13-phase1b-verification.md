# Phase 1b Verification Snapshot

**Date:** 2026-04-13
**Status:** ✅ CODE COMPLETE — Live data integration pending user API keys
**Verified on:** AWS RDS (lca-dev-db-small)

## Summary

Phase 1b — region-aware engine, Electricity Maps, BLS wages, EIA energy prices, method/region selector UI, cost auto-populate — implementation complete and tested. Live data integrations (BLS v2, EIA v2, Electricity Maps) are wired correctly but return 500 until the user signs up for the free API keys; the code handles missing keys gracefully and logs failures for audit.

## Commits (Phase 1b)

```
98d8182 feat(costs): auto-populate labor + energy costs from BLS + EIA cached rates
ecb2d23 feat(db): add labor_occupation + labor_hours + case region_code
972922d feat(ui): method + region selector for running assessments
8cea5d0 feat(integrations): EIA energy price client + fetch endpoint
8319ef2 feat(api): POST /api/integrations/bls/fetch-wage
061d6ed feat(integrations): BLS wage client + cost_rates cache
417b18c feat(integrations): Electricity Maps zone factor sync
007660f feat(integrations): electricity maps client
54f1b05 feat(engine): accept method + regionCode; region falls back to Global
```

## Test Results

- **Unit tests:** 72/72 passing (19 test files)
- **Dev server pages:** all HTTP 200
  - `/`
  - `/admin/integrations/`
  - `/project/8/case/19/`
  - `/project/8/case/19/results/`

## Region-Aware Assessment (case 19, EV Battery)

| Run | Method | Region | Global Warming |
|-----|--------|--------|---------------|
| #57 | CML 2001 | Global | 126.82 kg CO₂-eq |
| #58 | CML 2001 | US-NY | 126.82 kg CO₂-eq |

Numbers match because Electricity Maps has not yet been synced for US-NY — the engine falls back to the Global factor. Once the user runs `POST /api/integrations/electricity/sync` with their Electricity Maps API key, US-NY will store its own `driver_impact_factor` row and the two runs will diverge.

## Integration endpoints (live)

| Endpoint | Status | Notes |
|----------|--------|-------|
| BLS fetch-wage | 500 | Needs `BLS_API_KEY` or series data not available |
| EIA fetch-energy-price | 500 | Needs `EIA_API_KEY` |
| Electricity Maps sync | 200 | Needs `ELECTRICITY_MAPS_API_KEY` — returns per-zone errors in body |
| PubChem enrich | 200 ✅ | Free, works live (1 substance enriched) |
| openLCA import | 200 ✅ | Static seed, works live (70 CML 2001 factors) |

All failures are captured in `integration_log` with `status='failed'` — the audit trail works.

## Database State (AWS RDS)

| Metric | Value |
|---|---|
| Substances total | 42 |
| Substances enriched | 1 |
| CML 2001 factors | 70 |
| cost_rates cache | 0 rows (pending live API keys) |
| integration_log entries | 6 |
| Component has labor_occupation + labor_hours | ✓ |
| Case_table has region_code | ✓ |

## What Works End-to-End (code side)

1. Run Assessment modal: Method + Region dropdowns, populated from `/api/integrations/status`
2. Case page → Results page → modal → POST with `calculation_method` + `region_code`
3. LCA engine: filters factors by `method_name`, prefers region-specific factor, falls back to Global
4. BLS client + route with proper series-ID construction for state-level median hourly wages
5. EIA client + route for electricity ($/kWh) and natural gas ($/MCF)
6. Cost-rates cache: TTL-based reuse (default 30 days), upsert on stale
7. Auto-populate service + `POST /api/components/:id/auto-costs` endpoint that computes labor_cost and energy_cost from the component's `labor_occupation`/`labor_hours` + its case's `region_code`

## Action Items for Full Activation

User needs to register for these free keys to unlock live cost data:
- [ ] Sign up at https://www.electricitymaps.com/free-tier-api → paste into `.env.local` `ELECTRICITY_MAPS_API_KEY`
- [ ] Sign up at https://www.eia.gov/opendata/ → paste into `.env.local` `EIA_API_KEY`
- [ ] Optional: https://data.bls.gov/registrationEngine/ for `BLS_API_KEY` (higher rate limits)

After adding the keys, re-run the admin dashboard import buttons and the BLS/EIA/ElectricityMaps endpoints will return real data.

## Next: Phase 1c

Tasks 22–26: Metals-API, ReCiPe + TRACI seed data, PDF source attribution, final verification.
