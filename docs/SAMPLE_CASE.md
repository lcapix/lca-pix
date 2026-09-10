# Sample Case — Coffee Mug LCA (end-to-end walkthrough)

A complete worked example that takes you from a **new project** → **base case** → **5-tier
hierarchy** → **flows** → **assessment** → **comparative case** → **case comparison**, with both
the UI clicks and the equivalent API calls.

Everything below was executed live against production on **2026-07-07** using the shared test
account, so the IDs and numbers are real — you can open the links and see them.

- **App:** https://lcapix.vercel.app  (alias of `lca-project-v3.vercel.app`)
- **Test login:** `lcapix50@gmail.com` / `Lcapix@guerry123`
- **Methodology used:** CML 2001 · region NC

---

## What we built

| Thing | Name | ID | Link |
|---|---|---|---|
| Project | Sample: Coffee Mug LCA | `38` | [/project/38](https://lcapix.vercel.app/project/38) |
| Base case | Standard Production | `153` | [/project/38/case/153](https://lcapix.vercel.app/project/38/case/153) |
| Base assessment | Run #111 | `111` | [results](https://lcapix.vercel.app/project/38/case/153/results) |
| Comparative case | Recycled Clay Variant | `154` | [/project/38/case/154](https://lcapix.vercel.app/project/38/case/154) |
| Comparative assessment | Run #112 | `112` | — |
| Comparison | Standard vs Recycled Clay | — | [analytics](https://lcapix.vercel.app/project/38/analytics) |

**Headline result:** switching to 50% recycled clay (less kiln gas + less electricity) cuts the
mug's cradle-to-gate footprint from **6.09 → 3.75 kg CO₂ eq**, a **~38% reduction**.

---

## Step 0 — Log in and grab a token

```bash
BASE="https://lcapix.vercel.app"
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lcapix50@gmail.com","password":"Lcapix@guerry123"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
echo "$TOKEN"   # a JWT starting with eyJ
```

> All write endpoints use snake_case bodies (`project_name`, `case_name`, `component_name`, …)
> and require the `Authorization: Bearer $TOKEN` header.

---

## Step 1 — Create a project

**UI:** `/home` → **+ New Project** → name it → submit.

```bash
curl -s -X POST $BASE/api/projects \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"project_name":"Sample: Coffee Mug LCA","description":"350ml ceramic coffee mug — sample walkthrough"}'
# → { success: true, project: { project_id: 38, ... } }
```

---

## Step 2 — Create the base case

**UI:** project page → **+ Add Case** → name `Standard Production`, type **Base**.

```bash
PROJ_ID=38
curl -s -X POST $BASE/api/projects/$PROJ_ID/cases \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"case_name":"Standard Production","case_type":"base","description":"Baseline ceramic process"}'
# → { success: true, case: { case_id: 153, ... } }
```

---

## Step 3 — Build the 5-tier hierarchy

Each tier is a child of the one above: **Product → Machine/Line → Subprocess → Operation →
Elemental Task**.

**UI:** open the case editor → **+ Add Component** for each tier → drag under its parent (or pick a
parent in the dropdown).

```bash
CASE_ID=153
mk(){ curl -s -X POST $BASE/api/cases/$CASE_ID/components \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$1" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['component']['component_id'])"; }

P=$(mk '{"component_name":"Ceramic Coffee Mug (350ml)","component_type":"product"}')
M=$(mk "{\"component_name\":\"Forming Line\",\"component_type\":\"machine_line\",\"parent_component_id\":$P}")
S=$(mk "{\"component_name\":\"Slip Casting\",\"component_type\":\"subprocess\",\"parent_component_id\":$M}")
O=$(mk "{\"component_name\":\"Mold Filling\",\"component_type\":\"operation\",\"parent_component_id\":$S}")
T=$(mk "{\"component_name\":\"Mold Cleaning\",\"component_type\":\"elemental_task\",\"parent_component_id\":$O}")
echo "product=$P machine=$M subprocess=$S operation=$O task=$T"
# → product=233165 machine=233166 subprocess=233167 operation=233168 task=233169
```

Component types accepted by the API: `product`, `machine_line`, `subprocess`, `operation`,
`elemental_task`.

---

## Step 4 — Add flows (the inventory)

A **flow** is a substance consumed (`input`) or produced (`output`) at a node — the unit of LCA
accounting. Look up `substance_id`s first, then attach flows.

**UI:** click a node → **+ Add Flow** in the inspector → pick substance, direction, quantity, unit.

```bash
# Find substance ids (Electricity=7, Natural Gas=10 on prod today)
curl -s "$BASE/api/substances?limit=50" -H "Authorization: Bearer $TOKEN"

# Electricity at the elemental task
curl -s -X POST $BASE/api/components/$T/flows \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"substance_id":7,"flow_type":"input","quantity":2.5,"unit":"kWh"}'

# Kiln firing gas at the operation
curl -s -X POST $BASE/api/components/$O/flows \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"substance_id":10,"flow_type":"input","quantity":1.8,"unit":"m3"}'
# → { success: true, flow: { flow_id: ..., is_driver: 1, ... } }
```

---

## Step 5 — Run the assessment

**UI:** case editor → **Run Assessment** → pick **CML 2001** → confirm.

```bash
RESP=$(curl -s -X POST $BASE/api/cases/$CASE_ID/assessments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"calculation_method":"CML 2001","region_code":"NC"}')
echo "$RESP" | python3 -m json.tool
RUN_ID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['assessment']['run_id'])")
```

**Base case (Run #111) — total impacts:**

| Impact category | Value | Unit |
|---|--:|---|
| Global Warming | **6.09** | kg CO₂ eq |
| Acidification | 0.0045 | kg SO₂ eq |
| Photochemical Oxidation | 0.0639 | kg C₂H₄ eq |
| Resource Depletion | 0.0000135 | kg Sb eq |

> The `run_id` is nested at `assessment.run_id` (also mirrored at the top level as `run_id`).

---

## Step 6 — View results

**UI:** **View Results** (or the pulsing ✨ Magic Insights badge) →
[/project/38/case/153/results](https://lcapix.vercel.app/project/38/case/153/results).
Renders the impact categories, top contributors, per-flow breakdown, and a historical timeline.

```bash
curl -s $BASE/api/assessments/$RUN_ID -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# keys: assessment, summary, results, total_impacts, component_breakdown
```

**Magic Insights** (✨ button on the results page) is fully client-side — it composes deterministic
insight text (summary / "how to reduce 20%?" / cost-vs-CO₂ tradeoff / compare-to-base) from the
assessment data. Safe to demo, no LLM call.

---

## Step 7 — Create a comparative case

**UI:** project page → **+ Add Case** → name `Recycled Clay Variant`, type **Comparative**. The
editor opens with the base tree shown as a reference ("Synced from base · edit to diverge") until
you add your own components.

```bash
curl -s -X POST $BASE/api/projects/$PROJ_ID/cases \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"case_name":"Recycled Clay Variant","case_type":"comparative","description":"50% recycled raw clay"}'
# → { success: true, case: { case_id: 154, ... } }
```

Then rebuild the hierarchy (same as Step 3, but against `CASE_ID=154`) and add **lower** flow
quantities to model the recycled-clay savings — here electricity `2.5 → 1.6 kWh` and kiln gas
`1.8 → 1.1 m³` — and run its assessment (Run #112).

**Comparative case (Run #112) — total impacts:**

| Impact category | Value | Unit |
|---|--:|---|
| Global Warming | **3.75** | kg CO₂ eq |
| Acidification | 0.0029 | kg SO₂ eq |
| Photochemical Oxidation | 0.0391 | kg C₂H₄ eq |
| Resource Depletion | 0.0000086 | kg Sb eq |

---

## Step 8 — Compare the cases

**UI:** project page → **Compare Cases** → pick **Standard Production** (base) and **Recycled Clay
Variant** (comp) → the analytics page shows side-by-side impact charts and per-component deltas.

```bash
curl -s -X POST $BASE/api/comparisons \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"comparison_name":"Standard vs Recycled Clay","case_ids":[153,154],"project_id":38}'
# → { success: true, message: "Cases verified. View comparison in analytics." }
```

**Delta (Base → Recycled):**

| Impact category | Base | Recycled | Change |
|---|--:|--:|--:|
| Global Warming | 6.09 | 3.75 | **−38.4%** |
| Acidification | 0.0045 | 0.0029 | −36.0% |
| Photochemical Oxidation | 0.0639 | 0.0391 | −38.8% |
| Resource Depletion | 0.0000135 | 0.0000086 | −36.0% |

View: [/project/38/analytics](https://lcapix.vercel.app/project/38/analytics)

---

## One-shot script

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="https://lcapix.vercel.app"
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"lcapix50@gmail.com","password":"Lcapix@guerry123"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
auth=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
jid(){ python3 -c "import json,sys;print(json.load(sys.stdin)$1)"; }

PROJ=$(curl -s -X POST $BASE/api/projects "${auth[@]}" \
  -d '{"project_name":"Sample: Coffee Mug LCA","description":"walkthrough"}' | jid "['project']['project_id']")
CASE=$(curl -s -X POST $BASE/api/projects/$PROJ/cases "${auth[@]}" \
  -d '{"case_name":"Standard Production","case_type":"base"}' | jid "['case']['case_id']")
mk(){ curl -s -X POST $BASE/api/cases/$CASE/components "${auth[@]}" -d "$1" | jid "['component']['component_id']"; }
P=$(mk '{"component_name":"Ceramic Coffee Mug (350ml)","component_type":"product"}')
M=$(mk "{\"component_name\":\"Forming Line\",\"component_type\":\"machine_line\",\"parent_component_id\":$P}")
S=$(mk "{\"component_name\":\"Slip Casting\",\"component_type\":\"subprocess\",\"parent_component_id\":$M}")
O=$(mk "{\"component_name\":\"Mold Filling\",\"component_type\":\"operation\",\"parent_component_id\":$S}")
T=$(mk "{\"component_name\":\"Mold Cleaning\",\"component_type\":\"elemental_task\",\"parent_component_id\":$O}")
curl -s -X POST $BASE/api/components/$T/flows "${auth[@]}" -d '{"substance_id":7,"flow_type":"input","quantity":2.5,"unit":"kWh"}' >/dev/null
curl -s -X POST $BASE/api/components/$O/flows "${auth[@]}" -d '{"substance_id":10,"flow_type":"input","quantity":1.8,"unit":"m3"}' >/dev/null
curl -s -X POST $BASE/api/cases/$CASE/assessments "${auth[@]}" -d '{"calculation_method":"CML 2001","region_code":"NC"}' \
  | jid "['total_impacts']"
echo "Project $PROJ / base case $CASE created."
```

---

## Notes & gotchas

- **Assessment scope:** only nodes that carry flows contribute. Here 2 of 5 components had flows
  (`Mold Filling`, `Mold Cleaning`), so `components_with_flows: 2` in the summary — that's expected,
  not an error.
- **Zero-flow cases still "succeed":** running an assessment on a case with no flows returns
  success with empty results. Add at least one input/output before you trust the numbers.
- **Integration field names** (Suggest-costs buttons) are strict: BLS/EIA want `state`, Metals wants
  the enum symbol (`STL`, not `steel`). See [PUBLIC_API_GUIDE.md](PUBLIC_API_GUIDE.md) for the exact
  bodies.
- This walkthrough writes to the **shared production test account** — feel free to delete the
  `Sample: Coffee Mug LCA` project (ID 38) when you're done poking at it.
