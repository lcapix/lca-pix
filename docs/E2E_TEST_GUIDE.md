# LCAPIX v3 — End-to-End Test Guide

> Walk through every feature against the live production app at https://lca-project-v3.vercel.app.
> Each step is testable from both the **UI** and the **API**. Real bugs found while writing this guide are flagged inline as **🐛 BUG**.

**Last tested:** June 2, 2026 against Vercel production
**Test account:** `lcapix50@gmail.com` / `Lcapix@guerry123`
**Sample data:** "E2E Coffee Mug LCA" — a small ceramic mug, simple enough to trace through every screen.

---

## Sample data sheet (copy-paste these)

| Field | Value |
|---|---|
| Project name | `E2E Coffee Mug LCA` |
| Project description | `350ml ceramic coffee mug — end-to-end test` |
| Base case name | `Standard Production` |
| Comparative case name | `Recycled Clay Variant` |
| Product | `Ceramic Coffee Mug (350ml)` |
| Machine/Line | `Forming Line` |
| Subprocess | `Slip Casting` |
| Operation | `Mold Filling` |
| Elemental Task | `Mold Cleaning` |
| Region for API tests | `NC` (North Carolina) |
| Substance for flow | `Electricity` |

---

## STEP 0 — Login and grab a JWT (for API tests)

### UI
1. Visit https://lca-project-v3.vercel.app/auth/login
2. Email: `lcapix50@gmail.com`  Password: `Lcapix@guerry123`
3. Click **Log in** → should land on `/home`

### API
```bash
BASE="https://lca-project-v3.vercel.app"
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lcapix50@gmail.com","password":"Lcapix@guerry123"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
echo "$TOKEN"
```

**Expected:** A JWT string starting with `eyJ`.

---

## STEP 1 — Create a project

### UI
1. From `/home`, click **+ New Project**
2. Enter `E2E Coffee Mug LCA` and the description
3. Submit

### API
```bash
curl -s -X POST $BASE/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_name":"E2E Coffee Mug LCA","description":"350ml ceramic coffee mug — test"}'
```

**Expected:** `{success: true, project: {project_id: N, ...}}`

> 🐛 **BUG #1 — Field name inconsistency.** API expects `project_name`, not `name`. The UI's modern convention would be `name`. This is jarring for anyone building an integration. Same DB-snake-case pattern persists through every POST endpoint.

---

## STEP 2 — Create a base case

### UI
1. On the project page, click **+ Add Case**
2. Type `Standard Production`, choose **Base**, submit

### API
```bash
PROJ_ID=23  # use whatever ID you got back in step 1
curl -s -X POST $BASE/api/projects/$PROJ_ID/cases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"case_name":"Standard Production","case_type":"base","description":"Baseline test"}'
```

**Expected:** `{success: true, case: {case_id: N, ...}}`

> ✅ This one works correctly.

---

## STEP 3 — Build the 5-tier hierarchy

In the case editor, you'll add five components: one of each tier, each as a child of the one above. The API enforces the parent-child chain; the UI gives you a drag-tree.

### UI
1. Click **Open editor** on the case row
2. For each tier, click **+ Add Component** and pick the type
3. Drag children under parents (or pick parent from a dropdown)

### API
```bash
CASE_ID=137   # your case id
# 1. Product (no parent)
P=$(curl -s -X POST $BASE/api/cases/$CASE_ID/components \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"component_name":"Ceramic Coffee Mug (350ml)","component_type":"product"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['component']['component_id'])")

# 2. Machine/Line
M=$(curl -s -X POST $BASE/api/cases/$CASE_ID/components \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"component_name\":\"Forming Line\",\"component_type\":\"machine_line\",\"parent_component_id\":$P}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['component']['component_id'])")

# 3. Subprocess
S=$(curl -s -X POST $BASE/api/cases/$CASE_ID/components \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"component_name\":\"Slip Casting\",\"component_type\":\"subprocess\",\"parent_component_id\":$M}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['component']['component_id'])")

# 4. Operation
O=$(curl -s -X POST $BASE/api/cases/$CASE_ID/components \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"component_name\":\"Mold Filling\",\"component_type\":\"operation\",\"parent_component_id\":$S}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['component']['component_id'])")

# 5. Elemental Task
T=$(curl -s -X POST $BASE/api/cases/$CASE_ID/components \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"component_name\":\"Mold Cleaning\",\"component_type\":\"elemental_task\",\"parent_component_id\":$O}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['component']['component_id'])")

echo "Hierarchy: product=$P machine=$M subprocess=$S operation=$O task=$T"
curl -s $BASE/api/cases/$CASE_ID/components -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Expected:** 5 components, each pointing to its parent. The list endpoint returns them in tree order.

> ✅ Hierarchy creation works correctly.

---

## STEP 4 — Add a flow to the elemental task

A flow represents a substance consumed (input) or produced (output) at that node — the unit of LCA accounting.

### UI
1. In the case editor, click the **Mold Cleaning** node
2. Click **+ Add Flow** in the inspector panel
3. Pick **Electricity** from the substance dropdown
4. Direction `input`, quantity `2.5`, unit `kWh`
5. Save

### API
```bash
# First, look up a substance_id (Electricity has ID 7 on prod today)
curl -s "$BASE/api/substances?limit=10" -H "Authorization: Bearer $TOKEN"

# Then add the flow
T=233137  # task id from step 3
curl -s -X POST $BASE/api/components/$T/flows \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"substance_id":7,"flow_type":"input","quantity":2.5,"unit":"kWh"}'
```

**Expected:** `{success: true, flow: {...}}`

> 🐛 **BUG #2 (CRITICAL) — Flow creation fails.** As of June 2, 2026 the API returns `{"error":"Failed to create flow"}` (HTTP 500) for valid payloads. Root cause likely a DB constraint or missing column. **This blocks the assessment math from being meaningful — without flows, every Run Assessment returns zeros.** Verify in `app/api/components/[componentId]/flows/route.ts` line ~95 (the INSERT).

---

## STEP 5 — Test the public-API integrations

These are the live data fetches a user triggers from the component form's **Suggest costs** button.

### UI
In the component form, toggle one or more of **Labor / Energy / Material** and click **Suggest** — the form auto-fills cost rows from BLS, EIA, and Metals-API.

### API tests

#### 5a. BLS — labor wages (FREE, no API key needed)

```bash
curl -s -X POST $BASE/api/integrations/bls/fetch-wage \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"occupation":"51-4121","state":"NC"}'
```

**Returns:**
```json
{"success": true, "rate": {"rateValue": 53720, "unit": "$/hr", "source": "BLS OEWS 2025"}}
```

> 🐛 **BUG #3 — BLS unit confusion.** `rateValue: 53720` is the **annual** OEWS mean wage (per BLS), but the UI's `suggest()` function treats it as `$/hr` and divides by 0.5 hours: `labor = 53720 × 0.5 × quantity ≈ $26,860/component`. **Cost shows up wildly inflated.** Either the BLS client should return hourly (annual ÷ 2080) or the UI should annotate it as annual.

#### 5b. EIA — energy prices

```bash
curl -s -X POST $BASE/api/integrations/eia/fetch-energy-price \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fuel":"electricity","region":"NC"}'
```

**Returns:** `{"error":"Invalid body","issues":[{"path":["state"],"message":"Required"}]}`

> 🐛 **BUG #4 — EIA field mismatch.** The API expects `state`, but the UI sends `region`. **The Suggest button can never get an energy price.** Fix: rename one to match the other in `app/api/integrations/eia/fetch-energy-price/route.ts`.

#### 5c. Metals-API — commodity prices

```bash
curl -s -X POST $BASE/api/integrations/metals/fetch-price \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"symbol":"steel"}'
```

**Returns:** `{"error":"Invalid symbol. Supported: ALU, XCU, ZNC, NIK, LEA, TIN, STL"}`

> 🐛 **BUG #5 — Metals symbol mismatch.** The UI's `suggest()` sends `symbol: 'steel'`, but the API expects `STL`. Fix the UI in `components/component-form/component-form.tsx` (around line 1102) to send the API's enum.

#### 5d. PubChem — substance enrichment (admin only)

```bash
curl -s -X POST $BASE/api/integrations/pubchem/enrich \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"only_missing":true}'
```

**Returns:** `{"success":true,"summary":{"enriched":7,"notFound":34,"failed":0,"total":41}}`

> ✅ Works. Of 41 substances, 7 were enriched from PubChem; 34 had no match (these tend to be products like "Aluminum alloy, economical" rather than CAS-mapped raw substances).

#### 5e. openLCA — bulk factor import (admin only)

```bash
curl -s -X POST $BASE/api/integrations/openlca/import \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"method":"CML 2001"}'
```

**Returns:** `{"success":true,"result":{"method":"CML 2001","inserted":48,"substancesMatched":24}}`

> ✅ Works. Imported 48 CML 2001 characterization factors against 24 matching substances.

#### 5f. Electricity Maps — grid carbon (server sync)

```bash
curl -s -X POST $BASE/api/integrations/electricity/sync \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"zone":"US-CAR-DUK"}'
```

**Returns:** `{"error":"Invalid body"}`

> 🐛 **BUG #6 — Electricity Maps payload schema undocumented.** Returns generic "Invalid body" without telling the caller which field is wrong. Fix: emit the zod issues in the 400 response (like the EIA route does). Also: **this integration is not surfaced in the UI**; only an admin can trigger sync, and only via this curl. The component form has no "fetch grid intensity" button.

---

## STEP 6 — Run an assessment

### UI
1. In the case editor, click **Run Assessment** (top right)
2. Pick **CML 2001** as the methodology
3. (Optional) Region — leave blank for global
4. Confirm

### API
```bash
RESP=$(curl -s -X POST $BASE/api/cases/$CASE_ID/assessments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"calculation_method":"CML 2001","region_code":"NC"}')
echo "$RESP" | python3 -m json.tool
RUN_ID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['assessment']['run_id'])")
echo "Run ID: $RUN_ID"
```

**Expected:** `{success: true, assessment: {run_id, status:'completed'}, summary: {...}, results: [...]}`

> 🐛 **BUG #7 — Assessment runs even when there are zero flows.** Returns success + empty results. The user has no indication that "you ran an assessment on a case with no inventory; this is meaningless." **Add a check:** if `components_with_flows === 0`, return `{warning: 'No flows to assess; add at least one input/output before running.'}`.

> 🐛 **BUG #8 — runId nesting.** The response nests run_id under `assessment.run_id`. Most LCA tooling clients would expect it at the top level (e.g. `result.id`). Document either pattern but don't mix.

---

## STEP 7 — View results

### UI
1. After assessment finishes, click **View Results** (or the Magic Insights badge that pulses)
2. The page renders the 6 impact categories, top contributors, flow-level breakdown, and historical timeline

### API
```bash
curl -s $BASE/api/assessments/$RUN_ID -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Expected:** Full result object with `impacts: {Global warming: {value, unit}, ...}`, `componentBreakdown`, `costs`.

> ⚠️ Until BUG #2 is fixed and you can create flows, the results page will be entirely zeros. You can still verify the layout, charts, and **Magic Insights** modal renders.

---

## STEP 8 — Magic Insights AI assistant

### UI
1. On the Results page, click the **✨ Magic Insights** button (next to "Re-run")
2. Modal opens — text streams in (LLM-style typewriter)
3. Try the 4 action chips: Summary / How to reduce 20%? / Cost vs CO₂ tradeoff / Compare to base

> ✅ This feature is fully client-side (no LLM API call) — it composes deterministic insight text from the assessment data. Safe to demo.

---

## STEP 9 — Create a comparative case

### UI
1. Back on the project page, click **+ Add Case** again
2. Name `Recycled Clay Variant`, type **Comparative**, submit
3. Open editor — the tree starts empty
4. Until you add components, the canvas shows "Synced from base · edit to diverge" — the base case's tree as a reference

### API
```bash
curl -s -X POST $BASE/api/projects/$PROJ_ID/cases \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"case_name":"Recycled Clay Variant","case_type":"comparative","description":"50% recycled raw"}'
```

---

## STEP 10 — Run a comparison

### UI
1. On the project page, click **Compare Cases**
2. Pick **Standard Production** as base, **Recycled Clay Variant** as comp
3. The comparison page shows side-by-side impact charts and per-component deltas

### API
See `app/api/comparisons/route.ts` for the POST schema.

---

## Bugs summary (sorted by severity)

| # | Severity | Bug | Where |
|---|---|---|---|
| 2 | 🔴 CRITICAL | Flow creation returns "Failed to create flow" for valid payloads | `POST /api/components/[id]/flows` |
| 3 | 🟠 HIGH | BLS rate is annual but UI treats as hourly — costs inflated 100× | `lib/integrations/bls/client.ts` or `component-form.tsx:1067` |
| 4 | 🟠 HIGH | EIA expects `state`, UI sends `region` | `app/api/integrations/eia/fetch-energy-price/route.ts` |
| 5 | 🟠 HIGH | Metals expects `STL`, UI sends `steel` | `components/component-form/component-form.tsx:1102` |
| 7 | 🟡 MED | Assessment runs on zero-flow case with no warning | `app/api/cases/[id]/assessments/route.ts` |
| 6 | 🟡 MED | Electricity Maps returns "Invalid body" without details, not surfaced in UI | `app/api/integrations/electricity/sync/route.ts` |
| 1 | 🟢 LOW | API uses `project_name` not `name`; inconsistent with UI conventions | All `POST` route handlers |
| 8 | 🟢 LOW | Assessment runId nested under `assessment.run_id` — inconsistent | `app/api/cases/[id]/assessments/route.ts` |

---

## Re-running the whole test in one go

```bash
bash docs/scripts/e2e-smoke.sh   # (if you want a one-shot version, ask)
```
