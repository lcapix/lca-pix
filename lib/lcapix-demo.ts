// lcapix-demo.ts — typed demo data for the LCAPIX prototype.
// Mirrors LCAPIX/data.jsx. These act as visual placeholders; later
// phases will swap them for real API data.

export interface DemoUser {
  readonly name: string
  readonly initials: string
  readonly email: string
}

export const DEMO_USER: DemoUser = {
  name: 'Kavish',
  initials: 'KP',
  email: 'kavish@example.com',
}

export type ProjectType = 'base' | 'comparative'
export type ProjectStatus = 'active' | 'archived'

export interface DemoProject {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly type: ProjectType
  readonly status: ProjectStatus
  readonly cases: number
  readonly components: number
  readonly lastRun: string
  readonly updated: string
  readonly totalImpact: number
  readonly unit: string
  readonly impactTrend: readonly number[]
}

export const DEMO_PROJECTS: readonly DemoProject[] = [
  {
    id: 'ev-mfg',
    name: 'Electric Vehicle Manufacturing',
    description: '60 kWh NMC battery pack + assembly line. Baseline vs renewable energy scenario.',
    type: 'comparative',
    status: 'active',
    cases: 3,
    components: 47,
    lastRun: '3h ago',
    updated: '2 days ago',
    totalImpact: 126.82,
    unit: 'kg CO₂-eq',
    impactTrend: [118, 124, 122, 126, 128, 127, 126.82],
  },
  {
    id: 'pet-bottle',
    name: 'PET Bottle Packaging',
    description: 'Single-use 500ml PET bottle, injection molded. Comparing virgin vs rPET.',
    type: 'comparative',
    status: 'active',
    cases: 2,
    components: 18,
    lastRun: '1d ago',
    updated: '3 days ago',
    totalImpact: 0.112,
    unit: 'kg CO₂-eq',
    impactTrend: [0.14, 0.135, 0.128, 0.12, 0.118, 0.115, 0.112],
  },
  {
    id: 'concrete',
    name: 'Low-Carbon Concrete Mix',
    description: 'Cement replacement with GGBFS + fly ash. Structural mix, C30/37.',
    type: 'base',
    status: 'active',
    cases: 1,
    components: 22,
    lastRun: '5d ago',
    updated: '1 week ago',
    totalImpact: 284.5,
    unit: 'kg CO₂-eq/m³',
    impactTrend: [320, 315, 300, 295, 290, 286, 284.5],
  },
  {
    id: 'solar',
    name: 'Rooftop Solar Installation',
    description: 'Residential 8kW monocrystalline system. 25-year operational phase.',
    type: 'base',
    status: 'active',
    cases: 1,
    components: 31,
    lastRun: '2d ago',
    updated: '4 days ago',
    totalImpact: 42.1,
    unit: 'kg CO₂-eq/MWh',
    impactTrend: [50, 48, 46, 44, 43, 42.5, 42.1],
  },
  {
    id: 'textile',
    name: 'Organic Cotton T-Shirt',
    description: 'Cradle-to-gate, 180gsm jersey knit. Indian supply chain.',
    type: 'base',
    status: 'archived',
    cases: 1,
    components: 14,
    lastRun: '3w ago',
    updated: '1 month ago',
    totalImpact: 6.8,
    unit: 'kg CO₂-eq',
    impactTrend: [7.2, 7.1, 7.0, 6.9, 6.85, 6.82, 6.8],
  },
  {
    id: 'beef',
    name: 'Grass-Fed Beef Supply',
    description: 'Farm-to-retail, 1kg beef. Pasture-based Argentine operation.',
    type: 'base',
    status: 'active',
    cases: 1,
    components: 19,
    lastRun: '6h ago',
    updated: '1 day ago',
    totalImpact: 27.3,
    unit: 'kg CO₂-eq',
    impactTrend: [28, 28.2, 27.9, 27.7, 27.5, 27.4, 27.3],
  },
]

export type CaseType = 'base' | 'comparative'

export interface DemoCase {
  readonly id: string
  readonly projectId: string
  readonly name: string
  readonly type: CaseType
  readonly region: string
  readonly componentCount: number
  readonly driverCount: number
  readonly lastRun: string
  readonly method: string
  readonly totalImpact: number
  readonly unit: string
  readonly totalCost: number
  readonly assessed: boolean
}

export const DEMO_CASES: readonly DemoCase[] = [
  {
    id: 'baseline-2025',
    projectId: 'ev-mfg',
    name: 'Baseline Production 2025',
    type: 'base',
    region: 'US (National Grid)',
    componentCount: 5,
    driverCount: 13,
    lastRun: '3h ago',
    method: 'CML 2001',
    totalImpact: 126.82,
    unit: 'kg CO₂-eq',
    totalCost: 8420,
    assessed: true,
  },
  {
    id: 'renewable',
    projectId: 'ev-mfg',
    name: 'Renewable Energy Scenario',
    type: 'comparative',
    region: 'US (100% renewable)',
    componentCount: 5,
    driverCount: 13,
    lastRun: '4h ago',
    method: 'CML 2001',
    totalImpact: 91.3,
    unit: 'kg CO₂-eq',
    totalCost: 8660,
    assessed: true,
  },
  {
    id: 'recycled',
    projectId: 'ev-mfg',
    name: 'Recycled Cathode Materials',
    type: 'comparative',
    region: 'EU (Germany)',
    componentCount: 5,
    driverCount: 11,
    lastRun: '1d ago',
    method: 'ReCiPe',
    totalImpact: 78.4,
    unit: 'kg CO₂-eq',
    totalCost: 9010,
    assessed: true,
  },
]

export type HierarchyNodeType =
  | 'Product'
  | 'Machine'
  | 'Subprocess'
  | 'Operation'
  | 'Task'

export interface DemoTreeNode {
  readonly id: string
  readonly type: HierarchyNodeType
  readonly label: string
  readonly flows: number
  readonly cost: number
  readonly children?: readonly DemoTreeNode[]
}

export const DEMO_TREE: DemoTreeNode = {
  id: 'p1',
  type: 'Product',
  label: 'NMC Battery Pack (60 kWh)',
  flows: 2,
  cost: 8420,
  children: [
    {
      id: 'm1',
      type: 'Machine',
      label: 'Cell Production Line',
      flows: 4,
      cost: 3240,
      children: [
        {
          id: 's1',
          type: 'Subprocess',
          label: 'Cathode Coating',
          flows: 3,
          cost: 980,
          children: [
            {
              id: 'o1',
              type: 'Operation',
              label: 'Slurry Mixing',
              flows: 2,
              cost: 420,
              children: [
                { id: 't1', type: 'Task', label: 'NMC Powder Handling', flows: 6, cost: 180 },
                { id: 't2', type: 'Task', label: 'Solvent Dispensing', flows: 4, cost: 90 },
              ],
            },
            {
              id: 'o2',
              type: 'Operation',
              label: 'Drying Oven',
              flows: 3,
              cost: 560,
              children: [
                { id: 't3', type: 'Task', label: 'Thermal Treatment', flows: 5, cost: 320 },
              ],
            },
          ],
        },
        {
          id: 's2',
          type: 'Subprocess',
          label: 'Anode Coating',
          flows: 2,
          cost: 820,
          children: [
            {
              id: 'o3',
              type: 'Operation',
              label: 'Graphite Deposition',
              flows: 4,
              cost: 410,
              children: [
                { id: 't4', type: 'Task', label: 'Copper Foil Prep', flows: 3, cost: 210 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'm2',
      type: 'Machine',
      label: 'Module Assembly',
      flows: 3,
      cost: 2180,
      children: [
        {
          id: 's3',
          type: 'Subprocess',
          label: 'Cell Stacking',
          flows: 2,
          cost: 720,
          children: [
            {
              id: 'o4',
              type: 'Operation',
              label: 'Automated Pick-Place',
              flows: 3,
              cost: 380,
              children: [
                { id: 't5', type: 'Task', label: 'Robotic Welding', flows: 7, cost: 240 },
              ],
            },
          ],
        },
        { id: 's4', type: 'Subprocess', label: 'Busbar Welding', flows: 3, cost: 560 },
      ],
    },
    {
      id: 'm3',
      type: 'Machine',
      label: 'Pack Integration',
      flows: 3,
      cost: 1480,
      children: [
        { id: 's5', type: 'Subprocess', label: 'Thermal Management Install', flows: 2, cost: 640 },
        { id: 's6', type: 'Subprocess', label: 'BMS Integration', flows: 2, cost: 420 },
      ],
    },
  ],
}

export interface DemoContributor {
  readonly id: string
  readonly name: string
  readonly value: number
  readonly pct: number
  readonly cost: number
}

export const DEMO_CONTRIBUTORS: readonly DemoContributor[] = [
  { id: 'c1', name: 'Cathode Material (NMC)', value: 48.2, pct: 38.0, cost: 4200 },
  { id: 'c2', name: 'Electricity (Cell Production)', value: 32.7, pct: 25.8, cost: 1800 },
  { id: 'c3', name: 'Aluminum Housing', value: 18.4, pct: 14.5, cost: 1240 },
  { id: 'c4', name: 'Graphite Anode', value: 14.9, pct: 11.7, cost: 680 },
  { id: 'c5', name: 'Electrolyte (LiPF6)', value: 12.6, pct: 9.9, cost: 500 },
]

export interface DemoCategory {
  readonly id: string
  readonly name: string
  readonly unit: string
  readonly value: number
}

export const DEMO_CATEGORIES: readonly DemoCategory[] = [
  { id: 'gwp', name: 'Global Warming', unit: 'kg CO₂-eq', value: 126.82 },
  { id: 'ap', name: 'Acidification', unit: 'kg SO₂-eq', value: 0.58 },
  { id: 'ep', name: 'Eutrophication', unit: 'kg PO₄-eq', value: 0.14 },
  { id: 'odp', name: 'Ozone Depletion', unit: 'kg CFC11-eq', value: 0.0000042 },
  { id: 'pocp', name: 'Photochemical Oxid.', unit: 'kg C₂H₄-eq', value: 0.042 },
  { id: 'adp', name: 'Abiotic Depletion', unit: 'kg Sb-eq', value: 0.0018 },
]

export type FlowDir = 'IN' | 'OUT'

export interface DemoFlow {
  readonly id: string
  readonly component: string
  readonly substance: string
  readonly dir: FlowDir
  readonly amount: number
  readonly unit: string
  readonly factor: number
  readonly impact: number
}

export const DEMO_FLOWS: readonly DemoFlow[] = [
  { id: 'f1', component: 'Cathode Coating', substance: 'Carbon dioxide', dir: 'OUT', amount: 18.4, unit: 'kg', factor: 1.0, impact: 18.4 },
  { id: 'f2', component: 'Cathode Coating', substance: 'Methane', dir: 'OUT', amount: 0.08, unit: 'kg', factor: 28, impact: 2.24 },
  { id: 'f3', component: 'Cell Production Line', substance: 'Electricity (grid)', dir: 'IN', amount: 412, unit: 'kWh', factor: 0.385, impact: 158.62 },
  { id: 'f4', component: 'Anode Coating', substance: 'Copper', dir: 'IN', amount: 1.8, unit: 'kg', factor: 2.77, impact: 4.99 },
  { id: 'f5', component: 'Anode Coating', substance: 'N-Methyl-2-pyrrolidone', dir: 'IN', amount: 0.42, unit: 'kg', factor: 5.8, impact: 2.44 },
  { id: 'f6', component: 'Module Assembly', substance: 'Aluminum ingot', dir: 'IN', amount: 12.4, unit: 'kg', factor: 8.14, impact: 100.94 },
  { id: 'f7', component: 'Module Assembly', substance: 'Waste heat', dir: 'OUT', amount: 84, unit: 'MJ', factor: 0, impact: 0 },
  { id: 'f8', component: 'Pack Integration', substance: 'Steel (low-alloy)', dir: 'IN', amount: 4.2, unit: 'kg', factor: 1.95, impact: 8.19 },
  { id: 'f9', component: 'Cell Stacking', substance: 'Compressed air', dir: 'IN', amount: 28, unit: 'm³', factor: 0.08, impact: 2.24 },
  { id: 'f10', component: 'Busbar Welding', substance: 'Argon', dir: 'IN', amount: 0.8, unit: 'kg', factor: 7.9, impact: 6.32 },
]

export interface DemoMethod {
  readonly id: string
  readonly name: string
  readonly value: number
  readonly note: string
}

export const DEMO_METHODS: readonly DemoMethod[] = [
  { id: 'cml', name: 'CML 2001', value: 126.82, note: 'Midpoint, EU' },
  { id: 'recipe', name: 'ReCiPe Midpoint (H)', value: 72.37, note: 'Hierarchist' },
  { id: 'traci', name: 'TRACI 2.1', value: 70.36, note: 'US EPA' },
]

export type RunStatus = 'success' | 'partial' | 'error'

export interface DemoRun {
  readonly id: string
  readonly date: string
  readonly ts: number
  readonly value: number
  readonly status: RunStatus
}

export const DEMO_RUNS: readonly DemoRun[] = [
  { id: 'r1', date: 'Mar 14', ts: 1742000000, value: 138.4, status: 'success' },
  { id: 'r2', date: 'Mar 21', ts: 1742600000, value: 134.9, status: 'success' },
  { id: 'r3', date: 'Mar 28', ts: 1743200000, value: 132.1, status: 'success' },
  { id: 'r4', date: 'Apr 04', ts: 1743800000, value: 130.8, status: 'partial' },
  { id: 'r5', date: 'Apr 11', ts: 1744400000, value: 128.3, status: 'success' },
  { id: 'r6', date: 'Apr 18', ts: 1745000000, value: 126.82, status: 'success' },
]

export type IntegrationStatus = 'success' | 'warn' | 'error'

export interface DemoIntegration {
  readonly id: string
  readonly name: string
  readonly status: IntegrationStatus
  readonly lastRun: string
  readonly records: number
  readonly keyRequired: boolean
  readonly description: string
}

export const DEMO_INTEGRATIONS: readonly DemoIntegration[] = [
  { id: 'openlca', name: 'openLCA', status: 'success', lastRun: '2h ago', records: 5234, keyRequired: false, description: 'LCA factor database' },
  { id: 'pubchem', name: 'PubChem', status: 'success', lastRun: '5h ago', records: 1842, keyRequired: false, description: 'Chemical substances' },
  { id: 'emaps', name: 'Electricity Maps', status: 'success', lastRun: '18m ago', records: 412, keyRequired: true, description: 'Grid carbon intensity' },
  { id: 'bls', name: 'BLS', status: 'warn', lastRun: '1d ago', records: 238, keyRequired: true, description: 'Labor occupation codes' },
  { id: 'eia', name: 'EIA', status: 'success', lastRun: '6h ago', records: 94, keyRequired: true, description: 'Energy price data' },
  { id: 'metals', name: 'Metals-API', status: 'error', lastRun: '3d ago', records: 0, keyRequired: true, description: 'Commodity pricing' },
]

export type ActivityStatus = 'success' | 'info' | 'warn' | 'error'

export interface DemoActivity {
  readonly t: string
  readonly actor: string
  readonly action: string
  readonly source: string
  readonly status: ActivityStatus
}

export const DEMO_ACTIVITY: readonly DemoActivity[] = [
  { t: '4min ago', actor: 'Kavish', action: 'ran assessment on Baseline Production 2025', source: 'CML 2001', status: 'success' },
  { t: '1h ago', actor: 'System', action: 'refreshed Electricity Maps data (412 regions)', source: 'emaps', status: 'success' },
  { t: '2h ago', actor: 'Kavish', action: 'edited Cathode Coating component', source: 'editor', status: 'info' },
  { t: '3h ago', actor: 'Gary', action: 'created Renewable Energy Scenario', source: 'editor', status: 'info' },
  { t: '1d ago', actor: 'System', action: 'BLS occupation pull partial (rate limit)', source: 'bls', status: 'warn' },
  { t: '2d ago', actor: 'Kavish', action: 'exported PDF: EV Manufacturing Baseline', source: 'export', status: 'success' },
  { t: '3d ago', actor: 'System', action: 'Metals-API key expired — pricing unavailable', source: 'metals', status: 'error' },
  { t: '5d ago', actor: 'Kavish', action: 'imported 47 components from openLCA', source: 'openlca', status: 'success' },
]

export interface HierarchyTypeDef {
  readonly id: HierarchyNodeType
  readonly label: string
  readonly short: string
  readonly color: string
}

export const HIERARCHY_TYPES: readonly HierarchyTypeDef[] = [
  { id: 'Product', label: 'Product', short: 'P', color: 'var(--brand-primary)' },
  { id: 'Machine', label: 'Machine/Line', short: 'M', color: 'var(--chart-2)' },
  { id: 'Subprocess', label: 'Subprocess', short: 'S', color: 'var(--text-secondary)' },
  { id: 'Operation', label: 'Operation', short: 'O', color: 'var(--text-tertiary)' },
  { id: 'Task', label: 'Elemental Task', short: 'T', color: 'var(--chart-5)' },
]
