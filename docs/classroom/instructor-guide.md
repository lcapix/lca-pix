# LCAPIX in the classroom: instructor guide

Students take a real product, build its process tree, run a life cycle assessment (LCA) that follows
ISO 14040/14044, and explain the result. Every field in the app has a "?" hover with a plain-language
definition. You teach the judgement; the app handles the arithmetic.

## Learning goals, by ISO 14040 phase

| Phase | Students can... | Where in LCAPIX |
|---|---|---|
| Goal & scope | state a functional unit, a reference flow and a system boundary, and say why | New Project form; Goal & scope card on the case |
| Inventory (LCI) | list each step's inputs and outputs with amounts and units | Case tree → select an operation → Environmental Flows |
| Impact (LCIA) | explain impact = amount × characterization factor, and why methods differ | Run Assessment; results flow table |
| Interpretation | find what drives the result, judge how far to trust it, compare designs fairly | Results: contributor bars, per-functional-unit table, data-quality statement; Comparison page |
| Report | produce a report a reader can check | Export PDF / PowerPoint |

## Before class
- Each student (or team) needs an account and works in their own project.
- Decide one impact method for the whole class (CML 2001 is a good default). Results from different
  methods cannot be compared or added.
- Run the worked example below once yourself (about 30 minutes).

## Worked example (about 60 minutes in class)
1. **New project.** Give it a name and a functional unit, for example *One touring bicycle, ridden
   15,000 km over 10 years*. Boundary: cradle-to-gate.
2. **Import.** On the Import page, load the sample routing. It builds the process tree: operations with
   their labor hours. Then load the sample bill of materials, which adds the materials as inputs.
3. **Case page.** The status panel says where you are, what is blocking you, and what to do next. Open
   Goal & scope and set the reference flow (1 bike) and the data basis (1 bike).
4. **Inventory.** Click an operation. Review its flows and hover each "?". On a welding or curing step, use
   the machine-energy calculator (run hours × kW × load). Take the kW from a real machine's nameplate, add
   the kWh as an electricity input, and discuss where each number came from.
5. **Run.** Run the assessment. On the results page, read the headline, the contributor bars, the
   per-functional-unit table, the data-quality statement, and any warnings.
6. **Compare.** Duplicate the case, change one thing (for example, swap the aluminium frame tubes for steel
   by editing that flow), run it with the same method, and open the Comparison page.
7. **Report.** Export the PDF and check that it states the functional unit, boundary, results and data
   quality.

## Exercises
- **Functional unit and durability.** Set the functional unit to *1,000 km of riding*. Design A lasts
  15,000 km (reference flow 1,000 ÷ 15,000 ≈ 0.067 bike), design B lasts 10,000 km (0.1 bike). Which
  design wins per functional unit, and why can that differ from the per-bike answer?
- **Allocation.** Suppose the painting line also paints another product. Give the painting subprocess a
  physical (mass) share and re-run. What changed, and what would justify the share you chose?
  ISO 14044 prefers splitting the process first, then physical relationships, then economic value.
- **Data quality.** Using the data-quality statement, what share of the Global Warming result rests on
  industry averages or unverified factors? Which one flow would you replace first with supplier data,
  and why?
- **Method sensitivity.** Run the same case under CML 2001 and TRACI 2.1 in two separate runs. Explain why
  the numbers differ and why they must never be compared across methods.

## How the numbers are made
- Impact in a category = Σ (flow amount, converted to the factor's unit, × characterization factor).
- Material and energy factors apply to inputs; emission factors apply to outputs, so nothing is counted
  twice.
- A parent node is the sum of the steps below it. The engine warns if a parent also carries its own flows.
- Result per functional unit = case total × reference flow ÷ data basis.
- Each run freezes its inputs, factors, goal & scope and data-quality statement, so an old result stays
  reproducible after the model changes.

## Known limits (tell students up front)
- **Cradle-to-gate focus.** Use and end-of-life can be modeled as their own operations, but there is no
  stage-by-stage (EN 15804 A1 to D) breakdown yet.
- **Region.** Only electricity has region-specific factors (US, EU, Global). Every other flow uses a
  Global factor, and the data-quality statement says so.
- **Factor sources vary in strength.** Every material factor names its source, table and unit
  conversion (hover a factor in the results flow table). Several come from US EPA WARM (US data), and two
  industry-average EPDs (flat glass, concrete) are past their validity date but are still the newest
  published averages. The data-quality statement grades each source, so students can see what the
  result rests on.
- **No uncertainty analysis** (Monte Carlo) yet. Data quality is reported qualitatively.
- **Allocation** supports physical and economic shares. System expansion (crediting avoided products) is
  not supported.
- **Document import is demo-level.** Structured files work (CSV and similar); scanned PDFs do not (no
  OCR).
