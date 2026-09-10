# Getting Started — From Zero to a Comparative Analysis

A clean, from-scratch walkthrough: **create an account → new project → base case →
build the hierarchy → run an analysis → add a comparative case → compare them.**

Both the **UI clicks** and the equivalent **API calls** are shown for every step. For a fully
worked example with real IDs and numbers (a ceramic coffee mug), see
[SAMPLE_CASE.md](SAMPLE_CASE.md).

- **App:** https://lcapix.vercel.app
- **API base:** `https://lcapix.vercel.app/api`
- **Methodology used below:** CML 2001

All write endpoints use snake_case JSON bodies and (except signup/login) require an
`Authorization: Bearer <token>` header.

---

## Step 0 — Create an account (or log in)

**UI:** go to [`/auth/signup`](https://lcapix.vercel.app/auth/signup), enter name + email +
password, submit → you land on `/home`. (Returning users use
[`/auth/login`](https://lcapix.vercel.app/auth/login).)

**API:**
```bash
BASE="https://lcapix.vercel.app"

# Sign up (first time)
curl -s -X POST $BASE/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"yourname","email":"you@example.com","password":"YourPassw0rd!"}'

# Log in and capture the JWT for every later call
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"YourPassw0rd!"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
echo "$TOKEN"   # a JWT starting with eyJ
```

---

## Step 1 — Create a project

**UI:** on `/home`, click **+ New Project** → give it a name and description → submit.

**API:**
```bash
PROJ_ID=$(curl -s -X POST $BASE/api/projects \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"project_name":"My First LCA","description":"Getting-started project"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['project']['project_id'])")
echo "Project: $PROJ_ID"
```
> Note the field is `project_name` (snake_case), not `name`.

---

## Step 2 — Create the base case

The **base case** is your reference scenario — the "as-is" process you'll measure against.

**UI:** on the project page, click **+ Add Case** → name it (e.g. `Standard Production`), choose
type **Base**, submit.

**API:**
```bash
CASE_ID=$(curl -s -X POST $BASE/api/projects/$PROJ_ID/cases \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"case_name":"Standard Production","case_type":"base","description":"Baseline scenario"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['case']['case_id'])")
echo "Base case: $CASE_ID"
```

---

## Step 3 — Build the process hierarchy

Model your process as a 5-tier tree, each node a child of the one above:

**Product → Machine/Line → Subprocess → Operation → Elemental Task**

**UI:** open the case editor → **+ Add Component** for each tier → drag each under its parent
(or pick a parent from the dropdown).

**API** (`component_type` ∈ `product`, `machine_line`, `subprocess`, `operation`, `elemental_task`):
```bash
mk(){ curl -s -X POST $BASE/api/cases/$CASE_ID/components \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$1" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['component']['component_id'])"; }

P=$(mk '{"component_name":"Product","component_type":"product"}')
M=$(mk "{\"component_name\":\"Line\",\"component_type\":\"machine_line\",\"parent_component_id\":$P}")
S=$(mk "{\"component_name\":\"Subprocess\",\"component_type\":\"subprocess\",\"parent_component_id\":$M}")
O=$(mk "{\"component_name\":\"Operation\",\"component_type\":\"operation\",\"parent_component_id\":$S}")
T=$(mk "{\"component_name\":\"Task\",\"component_type\":\"elemental_task\",\"parent_component_id\":$O}")
echo "product=$P line=$M sub=$S op=$O task=$T"
```

---

## Step 4 — Add flows (the inventory)

A **flow** is a substance consumed (`input`) or produced (`output`) at a node. Flows are what the
assessment math actually runs on — **a case with no flows produces all-zero results.**

**UI:** click a node → **+ Add Flow** in the inspector → pick a substance, direction, quantity, unit.

**API:**
```bash
# Browse available substances (note the id you want; e.g. Electricity=7, Natural Gas=10)
curl -s "$BASE/api/substances?limit=50" -H "Authorization: Bearer $TOKEN"

# Attach flows to leaf nodes
curl -s -X POST $BASE/api/components/$T/flows \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"substance_id":7,"flow_type":"input","quantity":2.5,"unit":"kWh"}'

curl -s -X POST $BASE/api/components/$O/flows \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"substance_id":10,"flow_type":"input","quantity":1.8,"unit":"m3"}'
```

---

## Step 5 — Run the analysis

**UI:** in the case editor click **Run Assessment** → pick methodology **CML 2001** →
(optional) region → confirm.

**API:**
```bash
RESP=$(curl -s -X POST $BASE/api/cases/$CASE_ID/assessments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"calculation_method":"CML 2001","region_code":"NC"}')
RUN_ID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['assessment']['run_id'])")
echo "$RESP" | python3 -m json.tool     # summary + total_impacts + per-component results
```

Results come back across impact categories such as **Global Warming (kg CO₂ eq)**,
**Acidification (kg SO₂ eq)**, **Photochemical Oxidation (kg C₂H₄ eq)**, and
**Resource Depletion (kg Sb eq)**.

**View them —** UI: **View Results** (or the ✨ Magic Insights badge). API:
```bash
curl -s $BASE/api/assessments/$RUN_ID -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

## Step 6 — Add a comparative case

A **comparative case** is an alternative scenario (a design change, a greener input, a different
process) measured against the base.

**UI:** project page → **+ Add Case** → name it (e.g. `Greener Variant`), type **Comparative**,
submit. The editor opens showing the base tree as a reference until you diverge.

**API:**
```bash
COMP_ID=$(curl -s -X POST $BASE/api/projects/$PROJ_ID/cases \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"case_name":"Greener Variant","case_type":"comparative","description":"Alternative scenario"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['case']['case_id'])")
echo "Comparative case: $COMP_ID"
```

Now **repeat Steps 3–5 against `$COMP_ID`** — rebuild the hierarchy and add flows with the changed
quantities (e.g. less energy, a recycled material), then run its assessment. That gives the
comparative case its own results to diff against the base.

---

## Step 7 — Compare the two cases

**UI:** project page → **Compare Cases** → pick the **base** and the **comparative** case →
the analytics page shows side-by-side impact charts and per-component deltas.

**API:**
```bash
curl -s -X POST $BASE/api/comparisons \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"comparison_name\":\"Base vs Greener\",\"case_ids\":[$CASE_ID,$COMP_ID],\"project_id\":$PROJ_ID}"
# → { success: true, message: "Cases verified. View comparison in analytics." }
```
Then open **`/project/<PROJ_ID>/analytics`** to read the comparison.

---

## Quick reference

| Action | Method & path |
|---|---|
| Sign up | `POST /api/auth/signup` |
| Log in | `POST /api/auth/login` |
| Create project | `POST /api/projects` |
| Add case (base/comparative) | `POST /api/projects/:projectId/cases` |
| Add component | `POST /api/cases/:caseId/components` |
| List substances | `GET /api/substances` |
| Add flow | `POST /api/components/:componentId/flows` |
| Run assessment | `POST /api/cases/:caseId/assessments` |
| Get results | `GET /api/assessments/:runId` |
| Compare cases | `POST /api/comparisons` |

**Rules of thumb**
- Bodies are snake_case (`project_name`, `case_name`, `component_name`, `parent_component_id`).
- Build the hierarchy top-down — a child needs its parent's `component_id` first.
- Add at least one flow before running an assessment, or every impact comes back zero.
- `case_type` is `base` or `comparative`; you compare 2–10 cases at once.

## Where this data is stored
Everything you create is persisted to the app's **AWS RDS MySQL** database (`lca_v3`). See
[SAMPLE_CASE.md](SAMPLE_CASE.md) and the migration notes for details.
