# Demo walkthrough: one touring bike, documents to decision

Every number below was produced by the app on 2026-09-15 (runs 169, 170, 172) and matches a hand calculation. Roughly 12 to 15 minutes.

Before you start: dev server running, signed in as demo@lcapix.com, and a project name you have not used yet.

## 1. Define the study (2 min)

Projects, then New project.

- Project name: `Touring bike, aluminum frame`
- Goal of the study: `Which change cuts the cradle-to-gate carbon footprint of our aluminum touring bike most: the frame material or the electricity grid? For the design review.`
- Functional unit: `1 touring bicycle, at the factory gate`
- System boundary: Cradle-to-gate
- Primary methodology: TRACI 2.1
- Regional context: United States

Create Project. You land on Import with the routing preselected.

Say: this is ISO 14044 phase one. The functional unit is what every alternative is measured against, and the method and region chosen here are what every run uses.

## 2. Routing: the process skeleton (2 min)

Document type is already Process routing. Click Load a sample, then Preview extraction.

What appears: 19 nodes in four tiers (product, department, work center, operation), 8 labor costs, a note that setup time is per lot and stays out of per-unit labor, a note that the oven's time was divided by its base quantity, and the unmapped Tooling column offered as Ignore or Keep as a note.

Apply. Result: `19 steps created · costs on 8 steps`.

Say: the operation is the unit process. Hours come from the document, the wage is BLS reference data, and the basis line on each cost says so.

## 3. Bill of materials: what it is made of (3 min)

Click Add another document to this case. The BOM is preselected. Load a sample, then Preview extraction.

What appears: 22 lines, each already placed on a step with the reason "document says step 40", because the BOM carries an Op Seq column like Oracle and Epicor exports. Materials match the catalog at 100 percent. The two argon lines match nothing and stay unticked.

Apply. Result: `20 flows added across 7 steps · 7 cost entries updated`.

Say: the BOM says what goes in, the Op Seq says where it is consumed. Argon has no factor in the library, so it is held for review rather than guessed. That is the rule: nothing uncertain is applied silently.

## 4. Equipment list: the energy no ERP carries (2 min)

Add another document. The equipment list is preselected. Load a sample, then Preview extraction.

What appears: five electricity flows, each joined to its step by work center. Cold saw 0.165 kWh, TIG welder 0.358 and 0.224, booth fan 1.68, cure oven 1.24. A note says steps 60, 70 and 80 have no machine on the list.

Apply. Result: `5 flows added across 5 steps`.

Say: energy per step is rated kW times typical load times the hours the routing already gave, the estimate energy audits use when machines are not sub-metered. It is the patent's driver factor times driver value.

## 5. Transport leg by hand (1 min)

Open case. Select step 10 in the left list. In Environmental Flows click Add flow, search `ocean freight`, pick Transport, ocean freight. The transport calculator appears: mass 0.0022 tonnes, distance 11658 km, which fills 25.6476 tkm. Save flow.

The journey banner changes to "All the data is in. Next: run the assessment."

Say: no document type carries freight yet, so this one is entered by hand, and the tool computes tonne-km rather than asking for it.

## 6. Run and read the result (3 min)

Click Run assessment.

- Total: **88.73 kg CO2 eq**, TRACI 2.1
- By step: final assembly 41.6, wheels 22.9, frame tubes 19.3, box 3.15, powder coat 0.86
- Goal and scope block repeats the functional unit, boundary and goal
- Per functional unit: the total already is per functional unit, because the reference flow equals the data basis
- Data quality: 6 percent of the result rests on authoritative sources, 94 percent on industry averages, and 26 of 31 contributions used a Global factor because no US factor exists
- Flow table: every row shows its amount, its factor, whether the factor was US or Global (fallback), and its impact

Say: the factor source is on every row, so any number can be traced back to where it came from.

## 7. Magic Insights (1 min)

Click Magic Insights.

Summary says: totals 88.73 kg CO2 eq at $731.41, and "By material, Aluminum makes up 79.9% of it, across 5 steps: that is the biggest lever", then names the top steps. Below it, "What a sustainability consultant would look at" lists aluminum first (recycled or low-carbon alloy, lighter tubing, a steel copy of the case), then shop electricity at the powder booth and cure oven, marked as too small to start with, then supplier EPDs, because aluminum, rubber and steel use industry-average factors.

The other tabs: Trade-off says purchased material is 87.1% of the cost and labor 12.9%, and labor carries no flows, so the carbon lever is what you buy. Compare to base gives the rules for a fair comparison and the rows a swap can move. Ask anything suggests questions this case can answer. Every tab is marked "Computed deterministically from your assessment results. Not AI-generated." The AI toggle narrates the same facts.

Say: it names levers from this case's own flows and never adds a number of its own. A what-if is proven by running a copy.

## 8. Swap one: frame material (2 min)

From the case editor, click Duplicate, name the copy `Touring bike, steel frame` and confirm. You land on the copy. Select step 10, click the aluminum line to edit it, swap the substance to Steel and set 2.34 kg (a Surly Long Haul Trucker 58 cm frame). Save. Run assessment.

Result: **74.25 kg CO2 eq**, 16.3 percent lower. Only step 10 moves, 19.3 down to 4.81.

## 9. Swap two: the grid (1 min)

Go back to the base case and click Duplicate again, naming it `Touring bike, EU grid`. Click Run Assessment, set Region to Europe, run.

Result: **88.33 kg CO2 eq**, 0.45 percent lower.

## 10. Compare (3 min)

Project, then Compare Cases. The base and every copy are selected.

The header states the scope: Method TRACI 2.1, Regions US, EU, Per 1 touring bicycle at the factory gate, with the note that a difference between regions includes the electricity grid. Each card shows its value, its change against the base, the run it is compared on and that run's region. Cards show 88.73, 74.25 (16.3 percent lower) and 88.33. The line under them names the lowest case.

The tabs, in the order to show them:

- What differs: for each copy, the run settings that differ and every exchange swapped, changed, added or removed. The steel frame reads "Swapped, 10. Cut & miter frame tubes, Aluminum 2.2 kg → Steel 2.34 kg". The grid copy lists only its region.
- Where the change comes from: the difference split by step or by material, adding up to the total. For the steel frame, only step 10 moves.
- Hotspots: each step's or material's share of every case, with shares over 10 percent highlighted. Aluminum stays the largest share in the grid copy.
- Results: every impact category as values, change against the base, or relative to the largest.
- Cost: cost by kind per case, and for each copy the cost change against the impact change. If a swap did not update the step cost, it says so.
- Data quality: each run's sources, Global fallbacks and exchanges with no factor, side by side.

Say: the frame material moves the footprint 16 percent, the grid under half a percent. That answers the question we wrote in the goal, and the What differs tab shows each copy changed one thing.

## 11. Report (1 min)

On a results page, Export PDF or Export PPT. Both work (PDF about 21 KB, PPTX about 171 KB) and carry the method, region, functional unit and data-quality statement.

## Rough edges to work around in this build

- Compare Cases uses each case's latest run. If you tried another region on a case, re-run it on its own region before comparing. The region tag on each card shows what each run used.
- Use Compare Cases, not Analytics. Analytics is single-case and its header reads "Comparing 1 case".
- Pick the region inside the Run Assessment dialog for the grid variant.
- Materials carry a climate factor only, so acidification reflects electricity and freight. Say this before anyone asks.
