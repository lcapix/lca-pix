/**
 * Hover explanations for ISO 14040/14044 concepts, shared by every screen that
 * asks for or shows them, so a student reads the same definition everywhere.
 * Plain language first, the clause number for whoever wants the standard.
 */
export const ISO_HELP = {
  functionalUnit:
    'What every case in the study is measured against, so designs are compared fairly (ISO 14044 4.2.3.2). A cradle-to-grave study names the function and how much of it: "1 bicycle ridden 15,000 km". A cradle-to-gate study stops at the factory gate, before any use, so it states a declared unit instead: "1 touring bicycle, at the factory gate" (EN 15804 and ISO 21930 practice). Every case in the project uses this same unit.',
  systemBoundary:
    'Which life-cycle stages the study counts (ISO 14044 4.2.3.3). Cradle-to-gate: raw materials up to the factory gate (EN 15804 stages A1 to A3). Gate-to-gate: only the steps inside your plant. Cradle-to-grave: also use and end of life, which you model as their own operations.',
  boundaryNotes:
    'What is left out and why, plus the cut-off rule (ISO 14044 4.2.3.3). Example: "Excludes capital equipment and packaging; flows under 1% of total mass are cut off."',
  goal:
    'Why the study is done and who will read it (ISO 14044 4.2.2). Example: "Which frame material gives the lower carbon footprint, for the design review."',
  referenceFlow:
    "How much of this case's product one functional unit needs. If a bike lasts 15,000 km and the functional unit is 1,000 km of riding, the reference flow is about 0.067 bike. A design that lasts longer needs less product per functional unit, which is how durability shows up in the result.",
  dataBasis:
    'How much product the flows and costs you entered make. Enter 1 if you modeled one unit. Enter a year of output if you entered annual plant data (for example 52,000 bikes). Results are scaled by reference flow ÷ data basis. It is the same number as the product\'s quantity in the tree: change either one.',
  sharedScope:
    'Functional unit, boundary, goal and exclusions belong to the study, so every case in this project shares them: ISO 14044 only compares designs measured against the same functional unit. Reference flow and data basis belong to this case, because each design can need a different amount of product.',
  allocation:
    'Use this when the process also makes other products (co-products), so only part of its inputs and emissions belong to this one (ISO 14044 4.3.4). First try to avoid it by splitting the process into the steps each product uses. If you cannot, split by a physical relationship, usually mass; only if that fails, by economic value. Write down the basis so a reviewer can check it. It changes environmental results; costs stay as entered.',
  perFunctionalUnit:
    'ISO 14044 reports results per functional unit, so designs are compared on the same job done. Per functional unit = case total × reference flow ÷ data basis.',
  goalScopeRun:
    'What this run was for and what it covers, frozen when the run was made (ISO 14044 4.2). Change it on the case page, then re-run to record the new version.',
  dataQuality:
    "How far to trust the result (ISO 14044 4.2.3.6): where the factors come from, how well they match your region, and what was converted, left out or allocated. Each line is computed from this run's own flow table.",
  readTotal:
    'The sum of every flow × its characterization factor in this category, for the whole case. Lower is better. On its own the number means little: compare designs under the same method, region and functional unit, and use the bars to see which steps drive it. The result per functional unit is in Goal & scope below.',
  categoriesOverview:
    'Each category measures a different kind of environmental harm in its own unit, so they are never added together. Click one to see what drives it; hover it for what it measures.',
  flowTable:
    'One row per flow and category: Amount × Factor = Impact, after converting the amount to the factor\'s unit (* marks a conversion). Scope is the factor\'s region; "Global (fallback)" means no regional factor exists. Hover a factor for its source; ! marks a factor with no verified source.',
  flowSubstance:
    'What goes in or comes out: a material, fuel, electricity or an emission. Pick it from the catalog so it carries characterization factors; "no impact data" means the substance has none and adds nothing.',
  flowDirection:
    'Input: something this step consumes (steel, electricity, gas). Output: something it releases (CO₂, wastewater). Material and energy factors count on inputs; emission factors count on outputs.',
  flowQuantity:
    'How much, for the amount of product this case models (the data basis in Goal & scope). Take it from a bill of materials, a meter or an invoice where you can.',
  flowUnit:
    "Any unit that converts to the substance's own unit (g, kg, t; kWh, MJ). A unit that cannot be converted is left out of the result and flagged.",
  machineEnergy:
    'Machine energy = run hours × rated power (kW) × load (the share of full power it actually draws). All three come from you: the routing, the machine nameplate, a meter. Adding it as an electricity input lets the grid factor turn it into emissions.',
  /** The five ISO 14040 phases shown in the case status stepper. */
  phases: {
    'Goal & scope': 'Phase 1 (ISO 14040 5.2): say what the study is for, the functional unit, and which stages it covers.',
    Inventory: 'Phase 2, life cycle inventory (LCI): list every input and output of each process step, with amounts.',
    Impact: "Phase 3, impact assessment (LCIA): turn the inventory into impact scores with a method's characterization factors.",
    Interpretation: 'Phase 4: find what drives the result, check how far to trust it, and draw conclusions within the goal.',
    Report: 'Write it up so a reader can check it: the PDF or PowerPoint export states goal, scope, results and data quality.',
  } as Record<string, string>,
  caseCopyName:
    'A copy is a what-if: the same product system with one thing changed. Name it after that change, for example "steel frame" or "EU grid", so the comparison reads as the change and not as "Copy". One change per copy keeps each difference down to one cause.',
  region:
    'The factor region used by the next run. Region-specific factors exist only for electricity today (US, EU and Global grid mixes); every other flow uses its Global factor, shown as "Global (fallback)" in the flow table. A finished run keeps the region it was run with.',
} as const

/** What an impact category measures, matched by name across CML, TRACI and ReCiPe. */
export function impactCategoryHelp(name: string): string {
  const n = name.toLowerCase()
  if (/global warming|climate/.test(n))
    return 'Heat trapped by greenhouse gases over 100 years, counted as the CO₂ that would trap the same heat. Lower is better.'
  if (/acidif/.test(n))
    return 'Emissions such as SO₂ and NOₓ that turn into acid rain and acidify soil and lakes.'
  if (/eutroph/.test(n))
    return 'Nitrogen and phosphorus that over-fertilize water, causing algal blooms and oxygen-poor dead zones.'
  if (/ozone depl/.test(n))
    return 'Gases such as CFCs that thin the ozone layer high in the atmosphere.'
  if (/photochem|smog|ozone form/.test(n))
    return 'Emissions that react in sunlight to form ground-level ozone (smog), which harms lungs and crops.'
  if (/fossil/.test(n)) return 'Fossil fuels used up, weighted by how much harder they get to extract.'
  if (/resource|abiotic|mineral|depletion/.test(n))
    return 'Scarce minerals and resources used up, weighted by how scarce each one is.'
  if (/ecotox/.test(n)) return 'Toxic effects of emissions on plants and animals in water and soil.'
  if (/human|carcino|toxic/.test(n)) return 'Toxic effects of emissions on human health.'
  if (/particul|respirat/.test(n)) return 'Fine particles and gases that harm breathing.'
  if (/water/.test(n)) return 'Fresh water consumed or made scarce.'
  if (/land/.test(n)) return 'Land occupied or transformed, and the nature it displaces.'
  return 'One kind of environmental harm, measured in its own unit.'
}
