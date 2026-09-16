// Single source of truth for the documents the ingestion pipeline can read,
// what each one is for, and which layer of a case it fills.
//
// This registry is the backbone of the guided case-assembly flow: the connector
// dropdown, the "provide your documents" checklist, the completeness checker,
// and the preview route all read from here. Add or rename a document type in
// ONE place and every surface follows. The mapping (which layer a doc fills) is
// how we keep the process hierarchy correct: each document contributes a known
// layer to ONE case, never a whole standalone case.

/** How a document is turned into a ProcessModel. */
export type IngestMode =
  | 'structured' // deterministic parser (spreadsheet/CSV) — exact, no model
  | 'llm'; // LLM structuring path (PDF/HTML/text) — human-gated

/**
 * The layers of a complete product-system case. A single document usually fills
 * one or two of these; a comprehensive case needs most of them, assembled from
 * several documents. This is what the completeness checker reasons over.
 */
export type CaseLayer =
  | 'skeleton' // the node tree: lines / subprocesses / operations
  | 'materials' // material input flows (what goes in)
  | 'energy' // energy carrier input flows (electricity, gas, fuels)
  | 'emissions' // direct output flows (CO2, VOC, PM to air/water)
  | 'transport' // freight legs (tonne-km)
  | 'composition' // breakdown of one material into its substances (SDS)
  | 'factors' // supplier-specific characterization factors (EPD)
  | 'costs'; // the ABC cost columns (labor/energy/material/…)

/** Whether a document is needed for a case to be considered complete. */
export type Completeness = 'core' | 'recommended' | 'optional';

export interface DocType {
  /** Connector id — must match what /api/ingest/preview accepts. */
  id: string;
  /** Whether the connector is wired today or still planned. */
  status: 'live' | 'planned';
  /** UI name. */
  label: string;
  /** Industry aliases, so users recognise their own document by its real name. */
  aka: string[];
  /** One line: what this document contributes to the case. */
  provides: string;
  /** Which layers of the case this document populates. */
  fills: CaseLayer[];
  mode: IngestMode;
  /** File input `accept` string for this connector. */
  accept: string;
  /** How much a complete case depends on this document. */
  completeness: Completeness;
  /** A representative sample in the local corpus (for demos/tests). */
  sampleCorpus?: string;
}

export const DOC_TYPES: DocType[] = [
  {
    id: 'routing',
    status: 'live', // via the LLM structuring path today; a structured CSV variant is planned
    label: 'Process routing / Bill of Process',
    aka: ['routing sheet', 'route sheet', 'traveler', 'shop traveler', 'bill of operations', 'process flow diagram (PFD)'],
    provides: 'The operation sequence and plant hierarchy — the case skeleton.',
    fills: ['skeleton', 'costs'],
    // A spreadsheet routing is parsed deterministically (the usual export); a
    // PDF traveler goes through the LLM path (the import page says so per file).
    mode: 'structured',
    accept: '.csv,.xlsx,.pdf,.html,.txt',
    completeness: 'core',
    sampleCorpus: 'corpus/erp-gbi/GBI_PP_Exercises_v2.40.pdf',
  },
  {
    id: 'itac',
    status: 'live',
    label: 'DOE ITAC assessment',
    aka: ['IAC assessment', 'industrial energy assessment'],
    provides: 'Facility energy and utility streams (electricity, gas, coal, LPG, fuel oil) for a plant.',
    fills: ['skeleton', 'energy', 'emissions'],
    mode: 'structured',
    accept: '.xlsx',
    completeness: 'core',
  },
  {
    id: 'bom',
    status: 'live',
    label: 'Bill of materials (BOM)',
    aka: ['parts list', 'material list', 'indented BOM'],
    provides: 'Every material and part with quantity and unit — the material inputs and their cost.',
    fills: ['materials', 'costs'],
    mode: 'structured',
    accept: '.csv,.xlsx',
    completeness: 'core',
    sampleCorpus: 'corpus/bom/deluxe-touring-bike-bom.csv',
  },
  {
    id: 'equipment',
    status: 'live',
    label: 'Equipment list (machines and rated power)',
    aka: ['asset register', 'machine list', 'equipment inventory', 'nameplate data'],
    provides:
      "Each machine's rated power and work center. With the routing's hours, the electricity each step uses.",
    fills: ['energy', 'costs'],
    mode: 'structured',
    accept: '.csv,.xlsx',
    completeness: 'recommended',
  },
  {
    id: 'epd',
    status: 'live',
    label: 'Environmental Product Declaration (EPD)',
    aka: ['ISO 14025 declaration', 'Type III declaration', 'EN 15804 EPD'],
    provides: 'A supplier-specific cradle-to-gate factor (kg CO2e per unit) for a purchased material.',
    fills: ['factors'],
    mode: 'llm',
    accept: '.pdf,.html,.txt',
    completeness: 'recommended',
    sampleCorpus: 'corpus/epd/steel_dynamics_fabricated_structural_epd.pdf',
  },
  {
    id: 'sds',
    status: 'live',
    label: 'Safety Data Sheet (SDS)',
    aka: ['MSDS', 'GHS safety data sheet'],
    provides: 'Section 3 composition (weight %, CAS numbers) of one chemical or coating input.',
    fills: ['composition'],
    mode: 'llm',
    accept: '.pdf,.html,.txt',
    completeness: 'optional',
    sampleCorpus: 'corpus/sds/benjamin_moore_V430_epoxy_sds.pdf',
  },
  {
    id: 'utility',
    status: 'planned',
    label: 'Utility bill / meter data',
    aka: ['energy bill', 'kWh log', 'therms statement', 'sub-meter export'],
    provides: 'Metered electricity, gas, or fuel per period — the per-operation energy routings usually lack.',
    fills: ['energy', 'costs'],
    mode: 'llm',
    accept: '.pdf,.csv,.xlsx',
    completeness: 'recommended',
  },
  {
    id: 'emissions',
    status: 'planned',
    label: 'Emissions permit / stack test / env report',
    aka: ['Title V permit', 'CEMS report', 'stack test', 'GHG inventory'],
    provides: 'Direct process emissions (CO2, VOC, PM) as output flows on the operations that emit them.',
    fills: ['emissions'],
    mode: 'llm',
    accept: '.pdf,.html,.txt',
    completeness: 'recommended',
  },
  {
    id: 'transport',
    status: 'planned',
    label: 'Transport / shipping records',
    aka: ['shipping manifest', 'freight bill', 'logistics log'],
    provides: 'Mode, mass, and distance per inbound/outbound leg — the freight legs (tonne-km).',
    fills: ['transport', 'costs'],
    mode: 'llm',
    accept: '.pdf,.csv,.xlsx',
    completeness: 'recommended',
  },
  {
    id: 'costs',
    status: 'planned',
    label: 'Cost sheet / ABC rates',
    aka: ['standard cost sheet', 'labor rates', 'machine rates', 'overhead schedule'],
    provides: 'Labor, machine, overhead, and material rates — fills the cost columns when the BOM/routing do not.',
    fills: ['costs'],
    mode: 'structured',
    accept: '.csv,.xlsx',
    completeness: 'recommended',
  },
];

/** The connector ids that are wired today (accepted by /api/ingest/preview). */
export const LIVE_DOC_TYPES = DOC_TYPES.filter((d) => d.status === 'live');

export function getDocType(id: string): DocType | undefined {
  return DOC_TYPES.find((d) => d.id === id);
}

/** Human-readable label for a case layer (for the checklist and the checker). */
export const LAYER_LABEL: Record<CaseLayer, string> = {
  skeleton: 'Process hierarchy',
  materials: 'Material inputs',
  energy: 'Energy inputs',
  emissions: 'Direct emissions',
  transport: 'Transport legs',
  composition: 'Material composition',
  factors: 'Supplier factors',
  costs: 'Costs',
};

/**
 * Layers a complete manufacturing product case is expected to have. The
 * completeness checker compares this against what a case actually contains and
 * points at the document that would fill each gap.
 */
export const EXPECTED_LAYERS: CaseLayer[] = [
  'skeleton',
  'materials',
  'energy',
  'transport',
  'costs',
];
// Direct (foreground) emissions are not expected of every case: a plant that
// burns no fuel and runs no emitting process has none, and its upstream
// emissions come through the material and energy factors. They are added when
// a document states them (an ITAC assessment's fuels, a permit, a stack test).

/** The live document(s) whose `fills` includes a given layer — for "you're missing X, add Y". */
export function docsForLayer(layer: CaseLayer): DocType[] {
  return DOC_TYPES.filter((d) => d.fills.includes(layer));
}
