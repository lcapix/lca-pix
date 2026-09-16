import type { TourStep } from '@/components/global/guided-tour'

/**
 * The "Walk me through LCAPIX" tour. ~12 steps from empty-state home through
 * project → case → hierarchy → results. Each step:
 *   - navigates to the right page if needed
 *   - highlights a UI element
 *   - explains what the user is looking at and what to do next
 *
 * Selectors are intentionally permissive (data-tour="..." attributes) so the
 * tour survives UI re-styling. Add data-tour attributes to anchor elements
 * across the pages.
 */
export const LCAPIX_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="home-greeting"]',
    title: 'Welcome to LCAPIX',
    body: 'Life-cycle assessment with cost and environmental impact in the same view. This quick tour walks you from an empty dashboard to a defensible CO₂ number — about 90 seconds.',
    placement: 'bottom',
    navigate: '/home',
  },
  {
    selector: '[data-tour="home-kpi-projects"]',
    title: 'Your dashboard KPIs',
    body: 'These tiles give you a live read on your portfolio: total projects, completed assessments, factor pack size, and components across every project. Click any tile to drill in.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="home-new-project"]',
    title: 'Start a new project',
    body: 'Every LCA lives inside a project. A project can have multiple cases — typically a base case and one or more comparative scenarios.',
    actionHint: "Click 'New Project' — we'll wait while you create one.",
    placement: 'bottom',
  },
  {
    selector: '[data-tour="project-header"]',
    title: 'Your project workspace',
    body: 'You can have multiple cases per project — a base case (current state) and one or more comparative cases. The hierarchy you build is shared across cases unless you diverge it.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="project-add-case"]',
    title: 'Add cases for scenarios',
    body: 'Base case = today\'s production. Comparative case = the scenario you want to evaluate (e.g. switching aluminum → steel, or moving to a low-carbon grid).',
    actionHint: "Add a base case now if you haven't.",
    placement: 'bottom',
  },
  {
    selector: '[data-tour="project-open-editor"]',
    title: 'Open the case editor',
    body: 'This is where you build the process tree: Product → Machine/Line → Subprocess → Operation, with an optional Task under an operation. The operation is the unit process: its inputs, outputs and costs live there, and every level above is a sum.',
    actionHint: "Click 'Open editor'.",
    placement: 'top',
  },
  {
    selector: '[data-tour="case-goal-scope"]',
    title: 'Set the goal & scope',
    body: 'Before any run, say what the product does, measured: the functional unit (ISO 14044). Every case in the project shares it, so designs are compared on the same job. Each case also states its reference flow: how much product one functional unit needs.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="case-add-component"]',
    title: 'Build your hierarchy',
    body: 'Add a Product node first, then drill down. The pastel colors are tier-coded so deep trees stay readable. Drag nodes to restructure; auto-save is debounced.',
    placement: 'right',
  },
  {
    selector: '[data-tour="case-flow-input"]',
    title: 'Add input/output flows',
    body: 'Click an operation (a step with nothing under it) to add its flows: electricity consumed, material used, emissions released. Each flow references a substance with characterization factors; hover any "?" for what a field means.',
    placement: 'left',
  },
  {
    selector: '[data-tour="case-suggest-costs"]',
    title: 'Auto-fill cost data',
    body: 'Click "Suggest" to fill labor, energy and material costs from cited public reference rates (BLS wages, EIA electricity prices, USGS material prices). Pick a state for a live BLS wage, and edit anything to match your own invoices.',
    placement: 'top',
  },
  {
    selector: '[data-tour="case-run-assessment"]',
    title: 'Run the assessment',
    body: 'Pick CML 2001, ReCiPe Midpoint (H) or TRACI 2.1, and keep one method for every case you compare. The engine multiplies every flow by its characterization factors and sums up the tree. Run stays locked until a functional unit is set.',
    placement: 'left',
  },
  {
    selector: '[data-tour="results-total-impact"]',
    title: 'Read the results',
    body: 'The headline is the case total for the chosen category, and the bars show which steps drive it. Below it are the result per functional unit and a data-quality statement that says how far to trust the number. Magic Insights writes a plain-English summary.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="results-magic-insights"]',
    title: 'Magic Insights',
    body: 'Click here any time you want a written summary, "how to reduce 20%?" suggestion, or a cost-vs-CO₂ tradeoff analysis. It cites the exact components driving the result.',
    placement: 'top',
    nextLabel: 'Finish tour',
  },
]
