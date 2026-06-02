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
    body: "This is where you build the process hierarchy — Product → Machine/Line → Subprocess → Operation → Elemental Task. Five tiers, deepest where the real input/output flows live.",
    actionHint: "Click 'Open editor'.",
    placement: 'top',
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
    body: 'Click any Elemental Task to add the actual flows — electricity consumed, raw material used, emissions generated. Flows reference substances from the LCA database with their characterization factors.',
    placement: 'left',
  },
  {
    selector: '[data-tour="case-suggest-costs"]',
    title: 'Auto-fill cost data',
    body: 'Toggle Labor / Energy / Material and click "Suggest". BLS pulls US wage data, EIA pulls energy prices, Metals-API pulls commodity prices — and the form fills itself in for the selected region.',
    placement: 'top',
  },
  {
    selector: '[data-tour="case-run-assessment"]',
    title: 'Run the assessment',
    body: 'Pick CML 2001, ReCiPe (H), or TRACI 2.1. The engine traverses every flow under every component, multiplies by characterization factors, and produces impacts across 6+ categories plus an ABC cost summary.',
    placement: 'left',
  },
  {
    selector: '[data-tour="results-total-impact"]',
    title: 'Read the results',
    body: 'The headline total is your CO₂-eq under the chosen method. The contributor bars beneath show what is driving it. Click the ✨ Magic Insights button for a plain-English summary with citations.',
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
