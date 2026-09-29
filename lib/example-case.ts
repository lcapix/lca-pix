/**
 * The worked example a new account can load.
 *
 * A first screen should not be empty: Sustainable Minds starts a student on a
 * toaster, and a student who has never built a model needs something to take
 * apart before they build their own.
 *
 * Honesty rule for this file: the QUANTITIES here are illustrative and say so
 * on the case itself. They are the part a student replaces with their own
 * measurements. Everything they are multiplied by — the characterization
 * factors, their sources, the units — is the real library, so the result the
 * example produces is traceable line by line, and the lesson "where did this
 * number come from" works on it.
 */

export type ExampleFlow = {
  substance: string;
  direction: 'input' | 'output';
  quantity: number;
  unit: string;
  /** Printed on the flow so the reader knows the quantity is illustrative. */
  note: string;
};

export type ExampleStep = {
  name: string;
  type: 'operation';
  stage: 'materials' | 'production';
  laborHours?: number;
  flows: ExampleFlow[];
};

export const EXAMPLE_PROJECT = {
  name: 'Example: painted steel bracket',
  description:
    'A worked example to take apart. Every quantity is illustrative; replace them with your own and the numbers follow.',
  goal: 'Where does the footprint of a small fabricated part actually come from: the steel, or the shop?',
  method: 'TRACI 2.1',
  region: 'US',
};

export const EXAMPLE_CASE = {
  name: 'Painted steel bracket',
  description:
    'Example case. Quantities are illustrative, not measured; the factors and their sources are real.',
  functionalUnit: '1 painted steel bracket, at the factory gate',
  boundary: 'cradle-to-gate',
  referenceFlow: 1,
  referenceFlowUnit: 'bracket',
};

export const EXAMPLE_STEPS: ExampleStep[] = [
  {
    name: '10. Cut blank',
    type: 'operation',
    stage: 'materials',
    laborHours: 0.05,
    flows: [
      {
        substance: 'Steel',
        direction: 'input',
        quantity: 0.8,
        unit: 'kg',
        note: 'Illustrative: the blank weight. Weigh your own part and replace it.',
      },
      {
        substance: 'Electricity',
        direction: 'input',
        quantity: 0.05,
        unit: 'kWh',
        note: 'Illustrative: rated power x cutting time. Use the machine calculator on your own machine.',
      },
    ],
  },
  {
    name: '20. Weld tab',
    type: 'operation',
    stage: 'production',
    laborHours: 0.08,
    flows: [
      {
        substance: 'Electricity',
        direction: 'input',
        quantity: 0.12,
        unit: 'kWh',
        note: 'Illustrative: welder power x arc-on minutes.',
      },
      {
        substance: 'Argon',
        direction: 'input',
        quantity: 0.02,
        unit: 'm3',
        note: 'Illustrative: gas flow rate x arc-on minutes. Argon has no climate factor, which the data-quality statement will tell you.',
      },
    ],
  },
  {
    name: '30. Powder coat and cure',
    type: 'operation',
    stage: 'production',
    laborHours: 0.04,
    flows: [
      {
        substance: 'Electricity',
        direction: 'input',
        quantity: 0.4,
        unit: 'kWh',
        note: 'Illustrative: oven kW x cure hours, divided by the parts in a batch.',
      },
    ],
  },
];

/** What the example is meant to teach, shown once when it is loaded. */
export const EXAMPLE_POINTS = [
  'The steel dwarfs the shop: a purchased material usually carries the result.',
  'Argon has no climate factor in this method, so it adds nothing and the run says so.',
  'Change one quantity, run it again, and compare the two runs.',
];
