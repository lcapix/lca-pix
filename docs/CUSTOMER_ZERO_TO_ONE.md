# LCAPIX — Customer's First LCA in 15 Minutes

> A self-contained zero-to-one journey. Sign up → first project → first assessment → reading the result.
> Sample data is intentionally tiny so you can **verify the software's math against a calculator** as you go.

**Target audience:** A sustainability engineer who has never used LCAPIX before and wants to confirm the platform is doing the math right before trusting it on real work.

**You will need:** A browser. A calculator (optional — math is shown step by step). About 15 minutes.

**App URL:** https://lca-project-v3.vercel.app
**Test account:** `lcapix50@gmail.com` / `Lcapix@guerry123`
*(Or create your own via /auth/signup — both flows are tested.)*

---

## The sample case: an aluminum bookshelf bracket

We're going to model a tiny part — a single L-shaped aluminum bookshelf bracket — and compare it against a steel version. The hierarchy has just four nodes so we can walk through every screen without drowning in scale.

### Why this example?
- **Aluminum vs steel** is a real industry trade-off (lighter material but ~5× the CO₂ per kg).
- **Two flows total** so the math fits on a sticky note.
- The expected result is counter-intuitive: aluminum is *cheaper* but worse for CO₂. Great teaching moment.

---

## Sample data — type these into LCAPIX exactly

### Project
| Field | Value |
|---|---|
| Project name | `Bookshelf Bracket LCA` |
| Description | `One L-bracket for shelving — aluminum vs steel comparative` |

### Base Case
| Field | Value |
|---|---|
| Case name | `Aluminum bracket — current` |
| Type | `Base` |
| Description | `0.40 kg aluminum, 0.3 kWh cutting electricity, 4 min labor` |

### Hierarchy (just 4 nodes, top-down)

| Tier | Name | Notes |
|---|---|---|
| **Product** | `Aluminum bookshelf bracket` | top of the tree |
| **Machine/Line** | `Bracket forming line` | child of Product |
| **Operation** | `Cut and bend` | child of Machine/Line — skipping Subprocess for brevity |
| **Elemental Task** | `Stamping + cutting` | child of Operation — the leaf node where flows go |

### Flows on the Elemental Task (`Stamping + cutting`)

| # | Substance | Direction | Quantity | Unit | Why |
|---|---|---|---|---|---|
| 1 | **Aluminum, primary** | input | `0.40` | kg | mass of one bracket |
| 2 | **Electricity** | input | `0.30` | kWh | per-unit cutting energy |

### Comparative Case
| Field | Value |
|---|---|
| Case name | `Steel bracket — comparative` |
| Type | `Comparative` |
| Description | `1.0 kg steel sheet, 0.5 kWh cutting, 5 min labor` |

Same hierarchy, but with these flows on the elemental task:

| # | Substance | Direction | Quantity | Unit |
|---|---|---|---|---|
| 1 | `Steel, hot-rolled` (or closest available) | input | `1.0` | kg |
| 2 | `Electricity` | input | `0.50` | kWh |

---

## The math — what the software *should* output

We're going to compute **Global Warming Potential (GWP)** under **CML 2001** by hand. Then we'll feed the data into LCAPIX and compare.

### Characterization factors (CML 2001, GWP100)

These are the kg-CO₂-eq emitted per kg (or per kWh) of substance — preloaded in LCAPIX's CML 2001 factor pack:

| Substance | CML 2001 GWP factor | Unit |
|---|---|---|
| Aluminum, primary | **8.2** | kg CO₂-eq / kg |
| Steel, hot-rolled | **1.8** | kg CO₂-eq / kg |
| Electricity (US grid, average) | **0.42** | kg CO₂-eq / kWh |

> These are bundled in the openLCA factor pack at `lib/integrations/openlca/data/cml-2001-v4.ts`. You can verify by hitting `GET /api/driver-factors?method=CML 2001`.

### Aluminum bracket (base case)

```
GWP_aluminum_material  = 0.40 kg × 8.2 kg CO₂-eq/kg  = 3.28 kg CO₂-eq
GWP_aluminum_energy    = 0.30 kWh × 0.42 kg CO₂-eq/kWh = 0.126 kg CO₂-eq
                                                        ───────────────
                                          TOTAL = 3.406 kg CO₂-eq
```

### Steel bracket (comparative case)

```
GWP_steel_material  = 1.0 kg × 1.8 kg CO₂-eq/kg = 1.80 kg CO₂-eq
GWP_steel_energy    = 0.5 kWh × 0.42 kg CO₂-eq/kWh = 0.21 kg CO₂-eq
                                                  ───────────────
                                          TOTAL = 2.01 kg CO₂-eq
```

### Cost (ABC sum, approximate prices)

Using US average rates that LCAPIX's "Suggest costs" would fetch (when API keys are configured):

| Item | Rate | Qty | Cost |
|---|---|---|---|
| Aluminum, primary | $2.10 / kg | 0.40 kg | $0.84 |
| Steel, hot-rolled | $0.95 / kg | 1.0 kg | $0.95 |
| Electricity | $0.13 / kWh | 0.30 / 0.50 kWh | $0.039 / $0.065 |
| Welder labor (BLS OEWS 51-4121 NC) | $25.83 / hr | 4 / 5 min | $1.72 / $2.15 |

| Bracket | Material | Energy | Labor | **Total cost** |
|---|---|---|---|---|
| Aluminum | $0.84 | $0.04 | $1.72 | **$2.60** |
| Steel | $0.95 | $0.07 | $2.15 | **$3.17** |

### Expected verdict

| Metric | Aluminum (base) | Steel (comp) | Δ |
|---|---|---|---|
| GWP100 | **3.406** kg CO₂-eq | **2.01** kg CO₂-eq | **Steel is 41% lower CO₂** |
| Cost | **$2.60** | **$3.17** | **Aluminum is 18% cheaper** |

**Punchline:** Aluminum saves money but emits more CO₂. The classic ABC × LCA trade-off — exactly what the platform is built to surface.

If LCAPIX returns numbers within ~5% of these, the engine is correct. If it returns 0 or wildly different numbers, that's a bug — likely the engine-side flow processing issue tracked as **Bug #9** in the E2E audit. (Flow records get created but the engine doesn't aggregate them yet.)

---

## Walkthrough — every screen, every click

The "Walk me through" button on the home dashboard runs an in-app guided tour with arrows. Use it the first time. The detailed steps below are for verification.

### 1. Sign in

→ https://lca-project-v3.vercel.app/auth/login → email + password → **Log in**

You land on `/home`.

> **What to expect:** Dashboard with 4 KPI tiles (Projects, Assessments, Factors, Components), a "Your Projects" grid, and a Recent Activity sidebar. If this is a fresh signup, all KPIs read 0.

### 2. Start the guided tour (optional but recommended)

Click **✨ Walk me through** (top right of the dashboard). The tour overlays:
- A highlighted ring around the next element you should look at
- An arrow pointing at it
- A floating callout explaining what it is

Click **Next** to advance. The tour navigates between pages automatically when needed.

### 3. Create the project

Click **+ New project** → modal opens.
- Project name: `Bookshelf Bracket LCA`
- Description: `Aluminum vs steel L-bracket`
- Submit.

You land on `/project/{id}`.

### 4. Create the base case

On the project page, click **+ Add Case**.
- Case name: `Aluminum bracket — current`
- Type: `Base`
- Submit.

The case appears under "Cases".

### 5. Open the editor and build the hierarchy

Click **Open editor** on the case row. You're now on `/project/{id}/case/{id}`.

Click **+ Add Component** → tier dropdown → **Product**:
- Name: `Aluminum bookshelf bracket`

Right-click (or hover and click "+") on that node → add a **Machine/Line** child:
- Name: `Bracket forming line`

Repeat for **Operation** (`Cut and bend`) and **Elemental Task** (`Stamping + cutting`).

Verify the tree reads top-to-bottom:
```
Aluminum bookshelf bracket
  └── Bracket forming line
        └── Cut and bend
              └── Stamping + cutting
```

### 6. Add the two flows

Click the **Stamping + cutting** leaf node. In the inspector panel:
- Click **+ Add Flow**
- Substance: **Aluminum, primary** (search the dropdown)
- Direction: `Input`
- Quantity: `0.40`
- Unit: `kg`
- Save.

Repeat for the second flow:
- Substance: **Electricity**
- Direction: `Input`
- Quantity: `0.30`
- Unit: `kWh`
- Save.

> If the substance "Aluminum, primary" isn't in the dropdown, run the **openLCA import** once from `/admin/integrations` → openLCA card → "Import CML 2001". This populates 48+ characterization factors and the substance list.

### 7. Run the assessment

Click **Run Assessment** (top right of the canvas).
- Methodology: `CML 2001`
- Region: `NC` (or leave blank)
- Confirm.

The assessment runs. You're routed to the Results page.

**Expected Global Warming Potential: ≈3.41 kg CO₂-eq.**

If you see this number (±5%) — the engine is doing the math we expected.

> **If you see 0** — the flow-processing engine has a bug (item #9 in the audit; under investigation). Document the actual number returned and we'll trace it.

### 8. Use Magic Insights

Click **✨ Magic Insights**. The modal streams a written summary. Try each of the 4 chips:
- **Summary** — narrative of the result
- **How to reduce 20%?** — concrete suggestions citing the top contributor
- **Cost vs CO₂ tradeoff** — explains the dollar/CO₂ relationship
- **Compare to base** — placeholder until you have a comparative case

### 9. Add the comparative case

Back to the project page (breadcrumb top-left or `/project/{id}`). Click **+ Add Case**.
- Name: `Steel bracket — comparative`
- Type: `Comparative`
- Submit.

The new case appears. Open it. Notice the canvas shows the base hierarchy with a "Synced from base · edit to diverge" badge — that's the fall-back behavior so empty comp cases still show something useful.

Build the same hierarchy or copy from base, then add the steel-version flows (1.0 kg steel + 0.5 kWh).

Run an assessment on this case too. **Expected: ≈2.01 kg CO₂-eq.**

### 10. Compare the two cases

Back to the project page → click **Compare cases** → pick `Aluminum` as base and `Steel` as comparative.

The comparison page shows:
- Side-by-side impact totals
- Δ deltas per category
- Component-level differences

**Expected verdict: "Aluminum −18% cost, +69% CO₂" (or close).**

### 11. Export the report

On Results page, click **Export PDF** (top right). The browser's print dialog opens with a CV-quality ISO 14040/14044-aligned report.

---

## What you've verified by the end

- ✅ Auth + session works
- ✅ Project + case CRUD
- ✅ Full 5-tier hierarchy
- ✅ Substance dropdown + flow creation
- ✅ openLCA factor pack import
- ✅ Assessment engine produces a value matching the hand calculation
- ✅ Comparison engine surfaces the trade-off
- ✅ Magic Insights generates a written summary
- ✅ PDF export

If any of these fail or produce wrong numbers, you have a precise data point — sample data + expected output — to file a bug.

---

## Public API integrations — what each does at this moment

These power the **Suggest costs** button. Audit details + status in [`docs/PUBLIC_API_GUIDE.md`](PUBLIC_API_GUIDE.md).

| API | What "Suggest" does for the user | Status |
|---|---|---|
| **BLS** | Auto-fills US labor cost based on the welder occupation × state region | ✅ wired, free, works |
| **EIA** | Auto-fills electricity / gas rate for the chosen state | ⏸️ wired, needs `EIA_API_KEY` env var on Vercel |
| **Metals-API** | Auto-fills commodity material cost (steel, aluminum, …) | ⏸️ wired, needs `METALS_API_KEY` env var |
| **openLCA** | Bulk-import characterization factor packs for CML, ReCiPe, TRACI | ✅ runs, idempotent, bundled data |
| **PubChem** | Auto-enrich substance records with CAS / formula / hazard | ✅ free, works |
| **Electricity Maps** | (planned) Live grid carbon intensity by zone — not yet wired into the form | ⏸️ needs `ELECTRICITY_MAPS_API_KEY` + UI surface |

**To switch on Suggest costs end-to-end:**
1. Sign up at https://api.eia.gov/register and copy the key into `EIA_API_KEY` on Vercel.
2. Sign up at https://metals-api.com (free tier) and copy the key into `METALS_API_KEY`.
3. (Optional) Sign up at https://www.electricitymaps.com/free-tier-api and add `ELECTRICITY_MAPS_API_KEY`.
4. Redeploy. The Suggest button now fills BLS + EIA + Metals values into the cost form for the user's selected region.

---

## Known issues to expect during your test

These are documented in [`docs/E2E_TEST_GUIDE.md`](E2E_TEST_GUIDE.md):

| # | What you may see | Why |
|---|---|---|
| #9 | Assessment result is 0 even after adding flows | Flow processing engine doesn't yet aggregate flows from leaf components — under investigation. |
| API keys missing | "Suggest costs" doesn't fill anything | EIA / Metals keys aren't on Vercel yet. |
| Google sign-in shows "soon" badge | Expected | Google Cloud Console redirect URI whitelist pending. Use email/password for now. |

Everything else should work as described.

---

## File this doc with your QA process

Print or PDF this page. Walk through each step with a fresh browser session. Tick off each "Expected" line as you go. Any deviation — bug. Use the sample data and hand-calculated math as your acceptance criteria.

Welcome to LCAPIX.
