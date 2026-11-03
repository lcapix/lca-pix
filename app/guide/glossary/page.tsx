'use client'

const TERMS: { term: string; def: string }[] = [
  {
    term: 'LCA (Life-Cycle Assessment)',
    def: 'Systematic accounting of every environmental input and output of a product or process across its lifetime. Standardised by ISO 14040 (framework) and ISO 14044 (requirements).',
  },
  {
    term: 'Functional unit',
    def: 'The unit of service every case in a project is normalised to (e.g. "1 painted metal box", "1 kWh battery capacity", "1000 food containers"). Pick this before you start building cases: alternatives can only be compared if they share the same functional unit.',
  },
  {
    term: 'Reference flow',
    def: 'The quantity of product needed to fulfil one functional unit (e.g. four brake pads per "one brake pad set"). Stored on the case, with its unit.',
  },
  {
    term: 'System boundary',
    def: 'Which life-cycle stages the study covers: cradle-to-gate (raw material → factory door), cradle-to-grave (… → end-of-life), or gate-to-gate (single facility only).',
  },
  {
    term: 'Process tree',
    def: 'The 5-tier hierarchy LCAPIX uses to decompose a system: Product → Machine/Line → Subprocess → Operation → Elemental Task. Each level adds resolution; impacts roll up from the leaves to the root.',
  },
  {
    term: 'Elemental Task',
    def: 'The lowest level of the tree. Flows usually go here or on an Operation; the levels above add up what sits below them.',
  },
  {
    term: 'Driver / flow',
    def: 'A quantity attached to a step that the engine multiplies by a characterisation factor to compute impact (e.g. 12 kWh of grid electricity, or 5 g of VOC emission). Direction is input or output.',
  },
  {
    term: 'Substance',
    def: 'A catalogued chemical or resource (CAS-numbered, with hazard classification and molecular weight). Substances are the bridge between flows in your tree and characterisation factors in a method.',
  },
  {
    term: 'Characterisation factor',
    def: 'A coefficient from an LCIA method that converts a flow into an impact value (e.g. 1 kg methane = 28 kg CO2-eq under IPCC 2021 GWP100).',
  },
  {
    term: 'LCIA method',
    def: 'A consistent set of impact categories and characterisation factors. LCAPIX offers three: CML 2001, common in European studies; ReCiPe Midpoint (H); and TRACI 2.1, the US EPA method.',
  },
  {
    term: 'Midpoint vs. endpoint',
    def: 'Midpoint indicators stop at the physical effect (kg CO2-eq, kg SO2-eq). Endpoint indicators aggregate further into damage categories (human health DALYs, ecosystem species·year, resource $). Midpoint is more defensible; endpoint is more communicable.',
  },
  {
    term: 'Impact category',
    def: 'A class of environmental effect: Global warming, Ozone depletion, Smog formation, Acidification, Particulate matter, Eutrophication, etc.',
  },
  {
    term: 'Base case',
    def: 'The case the others are measured against. Typically captures the current production line / material mix / grid as-is.',
  },
  {
    term: 'What-if (a comparative case)',
    def: 'A copy of a case with one thing changed, measured against the base case. ISO 14044 calls this a comparative case. Each project can hold many; Compare reads each one against the first case you pick.',
  },
  {
    term: 'Assessment run',
    def: 'An immutable snapshot. Pressing Run the case freezes the current tree + flows + method + region and writes one assessment_runs row plus N assessment_results rows. Every number on Results comes from one specific run.',
  },
  {
    term: 'Hot spot',
    def: 'The component or category contributing the largest share of total impact. The first place to look when designing a comparative scenario: cutting hot spots delivers most of the win.',
  },
]

export default function GlossaryPage() {
  return (
    <>
      <div className="ds-section-label" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--ds-text)' }}
      >
        Glossary
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--ds-text-2)',
          lineHeight: 1.7,
          marginBottom: 28,
        }}
      >
        Short definitions for the terms used across LCAPIX.
      </p>

      <dl style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {TERMS.map((t) => (
          <div key={t.term}>
            <dt
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ds-text)',
                marginBottom: 4,
              }}
            >
              {t.term}
            </dt>
            <dd
              style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--ds-text-2)',
                lineHeight: 1.6,
              }}
            >
              {t.def}
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}
