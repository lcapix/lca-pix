# LCAPIX — Onboarding Manual

Welcome to **LCAPIX**, a web-based **Life Cycle Assessment (LCA)** platform for measuring and
comparing the environmental impact of manufacturing processes. This manual is your single
starting point: it explains what the platform is, the concepts behind it, how to log in, and how
to run the complete workflow end-to-end — then points you to the deeper reference docs.

> **New here?** Read sections 1–3 to understand the platform, then follow section 5 (the
> hands-on walkthrough) with the app open in another tab. Budget ~30 minutes.

---

## 1. What is LCAPIX?

LCAPIX helps manufacturers answer one question: **"What is the environmental footprint of making
this product, and how do I reduce it?"**

You model a production process as a tree, record the resources it consumes and emits, and the
platform calculates its impact across standard environmental categories (carbon, acidification,
resource depletion, etc.) following recognized LCA methodologies (CML 2001, ReCiPe, TRACI). You
can then create *alternative* versions of the process and compare them side by side to see which
is greener.

**Who uses it:** sustainability analysts, process engineers, and product teams who need
defensible environmental numbers for a product or process.

**What it replaces:** spreadsheets and desktop-only LCA tools — LCAPIX is web-based, multi-user,
and collaborative.

---

## 2. Core concepts (the mental model)

| Concept | What it is |
|---|---|
| **Project** | The top container for a body of LCA work (e.g. "Coffee Mug LCA"). Holds cases. |
| **Case** | One scenario within a project. Either a **Base case** (your reference/as-is process) or a **Comparative case** (an alternative you want to test against the base). |
| **Component** | A node in the process tree. Components form a **5-tier hierarchy** (see below). |
| **Flow** | A substance going **in** (input) or **out** (output) of a component — e.g. "2.5 kWh electricity in". Flows are the raw data the math runs on. |
| **Substance** | An entry from the shared library (Electricity, Natural Gas, Aluminum, …) that a flow references. |
| **Impact category** | An environmental metric the assessment computes — Global Warming (kg CO₂ eq), Acidification (kg SO₂ eq), etc. |
| **Assessment (run)** | A calculation over a case that turns its flows into impact numbers using a chosen methodology. |
| **Comparison** | A side-by-side diff of two or more cases' assessment results. |

### The 5-tier process hierarchy

Every process is modeled top-down as a tree. Each level is a child of the one above:

```
1. PRODUCT / SYSTEM      the thing being assessed        e.g. "Ceramic Coffee Mug (350ml)"
   └─ 2. MACHINE / LINE   major production stage          e.g. "Forming Line"
      └─ 3. SUBPROCESS     a step within that stage        e.g. "Slip Casting"
         └─ 4. OPERATION   a specific operation            e.g. "Mold Filling"
            └─ 5. ELEMENTAL TASK  where flows attach       e.g. "Mold Cleaning"
```

**Flows** (energy, materials, emissions) attach to the lower nodes. Only nodes with flows
contribute to the results — so a tree with no flows produces all-zero impacts.

---

## 3. Access & environment

| | |
|---|---|
| **Production app** | https://lcapix.vercel.app |
| **Sign up** | https://lcapix.vercel.app/auth/signup |
| **Log in** | https://lcapix.vercel.app/auth/login |
| **Hosting** | Vercel (Next.js app) |
| **Database** | AWS RDS MySQL (`lca_v3`) — where all projects, cases, and results are stored |

Create your own account from the signup page, or ask the team for a shared demo login.

---

## 4. What the platform looks like (the main screens)

- **/home** — your dashboard: all projects, plus **+ New Project**.
- **Project page** — lists the project's cases; actions: **+ Add Case**, **Compare Cases**.
- **Case editor** — the visual process tree (drag-and-drop). Add components, click a node to open
  the inspector and add flows, then **Run Assessment**.
- **Results page** — impact categories, top contributors, per-flow breakdown, a history timeline,
  and the **✨ Magic Insights** panel (plain-language summary of the results and how to cut impact).
- **Analytics page** — side-by-side comparison charts and per-component deltas between cases.

---

## 5. The complete workflow (hands-on)

This is the core loop. Full click-by-click + API version is in
**[GETTING_STARTED.md](GETTING_STARTED.md)**; a real worked example (a ceramic coffee mug, with
actual numbers) is in **[SAMPLE_CASE.md](SAMPLE_CASE.md)**.

1. **Create a project** — `/home` → **+ New Project** → name + description.
2. **Add a base case** — project page → **+ Add Case** → type **Base**.
3. **Build the hierarchy** — in the case editor, add a Product, then a Machine/Line under it, then
   Subprocess → Operation → Elemental Task. Each is a child of the one above.
4. **Add flows** — click the lower nodes → **+ Add Flow** → pick a substance, set direction
   (input/output), quantity, and unit. This is the inventory.
5. **Run the assessment** — **Run Assessment** → pick methodology **CML 2001** → confirm. Results
   appear across the impact categories.
6. **Review results** — open **View Results**; explore the charts and **Magic Insights**.
7. **Add a comparative case** — project page → **+ Add Case** → type **Comparative**. Rebuild the
   tree with your change (e.g. a recycled material or less energy) and run its assessment.
8. **Compare** — project page → **Compare Cases** → pick the base and the comparative case → read
   the side-by-side deltas on the analytics page.

**Worked result (from the sample):** a ceramic mug's Global Warming impact dropped from
**6.09 → 3.75 kg CO₂ eq (≈ −38%)** when switching to a 50% recycled-clay variant — exactly the
kind of decision the compare view is built to support.

---

## 6. Documentation index (what to read next)

Everything lives in `lca project v3/docs/`. Suggested reading order for a new team member:

| Order | Document | What it covers |
|---|---|---|
| 1 | **ONBOARDING_MANUAL.md** (this file) | Platform overview, concepts, the big picture |
| 2 | **[GETTING_STARTED.md](GETTING_STARTED.md)** | From-zero walkthrough: project → base → comparative → analysis, UI + API |
| 3 | **[SAMPLE_CASE.md](SAMPLE_CASE.md)** | A fully worked example with real IDs and numbers |
| 4 | **[CUSTOMER_ZERO_TO_ONE.md](CUSTOMER_ZERO_TO_ONE.md)** | The end-user's first-run journey / narrative |
| 5 | **[PUBLIC_API_GUIDE.md](PUBLIC_API_GUIDE.md)** | REST API + the external data integrations (BLS, EIA, metals, PubChem, openLCA) |
| 6 | **[E2E_TEST_GUIDE.md](E2E_TEST_GUIDE.md)** | Step-by-step test walkthrough of every feature |
| 7 | **[DB_MIGRATION.md](DB_MIGRATION.md)** | Database structure + how the data is stored/moved (ops) |

**Background / methodology** (one level up, in the `lca/` folder):
- `Manual(a).pdf` and `LCAPIX_MANUAL_*.docx` — the original product manual.
- `Documentation_*_Schema_*.md` — the data schema (v1 → v3), field definitions, and sample data.
- `Sustainable Deck.pdf` — the product/vision deck.
- `V0_Complete_User_Journey_Guide.md` — detailed hierarchy rules and edge cases per tier.

---

## 7. Glossary

- **LCA (Life Cycle Assessment)** — a standardized method (ISO 14040/14044) for quantifying the
  environmental impact of a product or process across its life cycle.
- **Functional unit** — the reference basis for the assessment (e.g. "1 mug", "1 kWh").
- **Inventory (LCI)** — the full set of input/output flows for the process.
- **Characterization / impact category** — converting inventory flows into an environmental metric
  (e.g. kg of various gases → kg CO₂ equivalent for Global Warming).
- **Methodology** — the factor set used for characterization (CML 2001, ReCiPe, TRACI).
- **Base vs Comparative case** — reference scenario vs an alternative measured against it.

---

## 8. Getting help

- Start with the doc index in section 6 — most questions are answered there.
- For API/integration specifics, see `PUBLIC_API_GUIDE.md`.
- For anything unclear, reach out to the LCAPIX team.

Welcome aboard — the fastest way to "get it" is to create a throwaway project and run the section-5
loop once end to end.
