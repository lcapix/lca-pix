'use client'

const TERMS: { term: string; def: string }[] = [
  {
    term: 'LCA (Life-Cycle Assessment)',
    def: 'Systematic accounting of every environmental input and output of a product or process across its lifetime. Standardised by ISO 14040 (framework) and ISO 14044 (requirements).',
  },
  {
    term: 'Functional unit',
    def: 'The unit of service every scenario in a project is normalised to (e.g. "1 painted metal box", "1 kWh battery capacity", "1000 food containers"). Pick this before you start building cases — alternatives can only be compared if they share the same functional unit.',
  },
  {
    term: 'Reference flow',
    def: 'The quantity of product needed to fulfil one functional unit (e.g. four brake pads per "one brake pad set"). Stored at the Product node.',
  },
  {
    term: 'System boundary',
    def: 'Which life-cycle stages the study covers — cradle-to-gate (raw material → factory door), cradle-to-grave (… → end-of-life), or gate-to-gate (single facility only).',
  },
  {
    term: 'Process tree',
    def: 'The 5-tier hierarchy LCAPIX uses to decompose a system: Product → Machine/Line → Subprocess → Operation → Elemental Task. Each level adds resolution; impacts roll up from the leaves to the root.',
  },
  {
    term: 'Elemental Task',
    def: 'The leaf level of the tree. The only level that can carry flows (drivers) — everything above just structures the calculation.',
  },
  {
    term: 'Driver / flow',
    def: 'A quantity attached to an Elemental Task that the engine multiplies by a characterisation factor to compute impact (e.g. 12 kWh of grid electricity, or 5 g of VOC emission). Direction is input or output.',
  },
  {
    term: 'is_driver flag',
    def: 'Marks a flow as the primary impact driver for its Elemental Task. If your assessment returns 0, this flag is almost certainly missing or the substance reference did not resolve.',
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
    def: 'A consistent set of impact categories and characterisation factors. CML 2001 and CML-IA 2016 are EU midpoint baselines; ReCiPe Midpoint (H) and Endpoint (H/A) cover both levels; TRACI 2.1 is the US EPA equivalent; IPCC 2021 covers climate change only; EPS 2020 produces a single monetised score.',
  },
  {
    term: 'Midpoint vs. endpoint',
    def: 'Midpoint indicators stop at the physical effect (kg CO2-eq, kg SO2-eq). Endpoint indicators aggregate further into damage categories (human health DALYs, ecosystem species·year, resource $). Midpoint is more defensible; endpoint is more communicable.',
  },
  {
    term: 'Impact category',
    def: 'A class of environmental effect — Global warming, Ozone depletion, Smog formation, Acidification, Particulate matter, Eutrophication, etc.',
  },
  {
    term: 'Base case',
    def: 'The reference scenario. Pinned in every comparison. Typically captures the current production line / material mix / grid as-is.',
  },
  {
    term: 'Comparative case',
    def: 'An alternative scenario you measure against the base. Each project can hold many; the comparison view flips between them while keeping the base as the reference.',
  },
  {
    term: 'Assessment run',
    def: 'An immutable snapshot. Hitting Run Assessment freezes the current tree + flows + method + region and writes one assessment_runs row plus N assessment_results rows. Every chart on the Results page is sourced from a specific run.',
  },
  {
    term: 'EPS / ELU',
    def: 'Environmental Priority Strategies / Environmental Load Unit. A monetisation method that rolls every impact category into one weighted score (Euros of willingness-to-pay to avoid). Useful for executive-level comparisons.',
  },
  {
    term: 'Hot spot',
    def: 'The component or category contributing the largest share of total impact. The first place to look when designing a comparative scenario — cutting hot spots delivers most of the win.',
  },
  {
    term: 'ECP Library',
    def: 'Environmental Component Profile library — reusable tree templates with pre-bound flows (e.g. "standard steel sheet stamping operation"). Carried over from v1 as a roadmap item for v3.',
  },
  {
    term: 'EcoSpold / ILCD',
    def: 'Industry data-exchange formats for LCI datasets. LCAPIX imports openLCA datasets in either format via the Integrations panel.',
  },
]

export default function GlossaryPage() {
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--text-primary)' }}
      >
        Glossary
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          marginBottom: 28,
        }}
      >
        Short definitions for the terms used across the LCAPIX UI and the
        LCAPIX v1/v2 handbooks.
      </p>

      <dl style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {TERMS.map((t) => (
          <div key={t.term}>
            <dt
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 4,
              }}
            >
              {t.term}
            </dt>
            <dd
              style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--text-secondary)',
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
