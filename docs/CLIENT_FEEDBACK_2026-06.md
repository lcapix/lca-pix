# LCAPIX — Client Feedback Notes (Demo Call)

Captured from the stakeholder demo walkthrough (Professor + Daniel reviewing,
Kavish presenting). Organized by area with priority. Proposed todos at the
bottom — to be refined before implementation.

> Scope note: this call also covered two **unrelated** projects (the Ironclad
> encryption/decryption demo, and the Third Rock / Shopify website). Those are
> captured at the very end under "Separate threads" so they don't get folded
> into the LCAPIX backlog.

---

## 1. Magic Insights / AI button — HIGHEST PRIORITY
> "This is where people are going to spend their time… they build their project,
> then they hack and hack. They present to a committee, the committee says 'can
> you do better on this and this.'"

- **Reduce-by-X% must be user-selectable**, not a fixed 20%. Add a prompt/input
  so the user picks the target (30%, 40%, 50%, any). "Let them decide what
  percentage they want to reduce by."
- **Rephrase "How to reduce 20%?"** → "Reduce **environmental load** by X%."
- **"Cost vs CO₂ trade-off" → "Cost vs environmental load trade-off."** Don't
  limit to CO₂.
- **Cover ALL impact categories, not just CO₂.** The AI's reduce/trade-off
  actions should work across every category (GWP, acidification, ozone
  depletion, photochemical oxidation, etc.) — CO₂-eq alone "is not going to be
  sufficient."
- **Expand scope, don't narrow it.** A free-text prompt box for the user is
  fine. The "magic" is that if a target isn't practically possible, the AI says
  so — that's a valid, useful answer.
- **Keep "Compare to base"** — explicitly liked ("Compared to base is great").
- After "Got it", the flow ends; reruns are possible — fine as-is.

## 2. Data provenance / flows
- **Show the source DATABASE for every substance/flow.** When a user adds
  "Electricity · 1 kWh", the inspector must show *which* database it came from
  (ecoinvent / openLCA / PubChem / etc.). Professor asked repeatedly "what
  database is that coming from?" — currently not shown. Important.
- **Energy input must support multiple power sources**, not just electricity:
  natural gas, coal-fired, etc. "The power does not have to be electricity."

## 3. Hierarchy / canvas UX
- **"View full hierarchy" readability** — Daniel: boxes aren't outlined well /
  hard to read. Improve outlines/contrast (it reads OK only when zoomed in).
- **Rename the "Depth" column → "Tree depth."** "Depth doesn't mean anything to
  me or anybody else." Values like L4 = tree depth level. (It's a hierarchy /
  tree-depth concept.)

## 4. Analytics
- **Add COST analysis to the Analytics page.** Currently only "impact by
  category" is there. "What about the cost?" — cost should appear in analytics
  as well as the summary. (LCAPIX's whole point is cost ↔ impact together.)

## 5. Export
- **Finish PDF export** (was the last thing being wired; confirm it works).
- **Add PowerPoint export** (or make PDF→PPT trivial). Users present to
  committees; "sometimes PDFs are hard to deal with… unless you have Adobe."
- Exports must carry ISO 14040/14044 attributions (already planned).

## 6. Docs / polish / correctness
- **Finish the Docs/help-manual content** (seeded from the professor's manual;
  first-assessment, data model, getting started, glossary). Professor will
  review in detail.
- **Finish the Docs tour button** (not completed yet).
- **Stale node data**: a node showed "0 flows / cost" that wasn't updated —
  professor said he'll update it; verify the display always reflects real data.

---

## Proposed LCAPIX todos (draft — refine before building)

**P0 — Magic Insights overhaul (most valued)**
1. Make reduce-target a user-entered percentage (prompt box), not fixed 20%.
2. Re-label actions: "Reduce environmental load by X%", "Cost vs environmental
   load trade-off."
3. Make the AI operate across all impact categories, not just CO₂; let the user
   pick the category (or "overall environmental load").
4. Free-text prompt so users can push scope ("can you do better?").

**P1 — Provenance + energy flexibility**
5. Surface the source database on each flow/substance in the inspector + flow list.
6. Support multiple energy/power source substances (electricity, natural gas,
   coal, …) in the flow picker / suggestions.

**P1 — Analytics**
7. Add cost analysis/visualizations to the Analytics page.

**P2 — Canvas/hierarchy polish**
8. Improve "View full hierarchy" box outlines/contrast/readability.
9. Rename "Depth" column → "Tree depth."

**P2 — Export**
10. Confirm/finish PDF export; add PowerPoint export (or easy PDF→PPT).

**P3 — Docs**
11. Fill Docs content; finish the Docs tour button.

---

## Separate threads (NOT LCAPIX)
- **Ironclad encryption/decryption demo:** Daniel + Kavish to coordinate. Needs
  the old white papers/poster from Michelle's repository, a flow diagram of how
  encrypt/decrypt differs from market systems, then a simple "encrypt data →
  decrypt data" demo + website content. Target: live before San Diego. Call set
  for Sunday (Professor, Daniel, Kavish).
- **Third Rock / Shopify website:** Ryan's email re Fabio + Shopify disconnect;
  Shopify Collective emails. Separate from LCAPIX — Kavish to check, not caused
  by LCAPIX work.
