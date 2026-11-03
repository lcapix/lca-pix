'use client'

export default function DataModelPage() {
  return (
    <>
      <div className="ds-section-label" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--ds-text)' }}
      >
        Data model
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--ds-text-2)',
          lineHeight: 1.7,
        }}
      >
        Every LCA in LCAPIX is organised around a strict five-tier process
        tree, inherited from the original v1 desktop platform and preserved
        across v2/v3. The hierarchy mirrors how an LCA practitioner actually
        decomposes a system: from the whole product down to the individual
        elementary flows that the impact engine consumes.
      </p>

      <Section title="Project">
        Top-level container. Owns a name, the study's goal, functional unit, boundary, method
        (CML 2001, ReCiPe Midpoint (H) or TRACI 2.1), region, and members. Multiple cases live inside one project: typically one base
        case plus N comparatives sharing the same functional unit.
      </Section>

      <Section title="Case">
        A single scenario within the project. Two types:
        <Ul>
          <Li>
            <strong>Base case</strong>: the reference scenario (the as-is
            production line, the existing material mix, the current grid).
          </Li>
          <Li>
            <strong>Comparative case</strong>: an alternative being
            evaluated. Inherits the same functional unit as the base; only the
            substitutions you care about should differ.
          </Li>
        </Ul>
        Cases store name, description, type, parent project, and (once
        assessed) one or more <em>assessment runs</em>.
      </Section>

      <Section title="Five-tier process tree">
        Every case rolls up from a single Product node through Machine/Line,
        Subprocess, Operation, and Elemental Task leaves. The counts below are typical sizes, not limits.
        <Table
          rows={[
            ['1. Product / System', 'Root', '1 per case', 'Painted Metal Box · Li-ion Battery Pack · Solar Panel'],
            ['2. Machine / Line', 'Tier 2', '1–20 per Product', 'Cell Assembly Line · Spray Painting Booth · Box Assembly'],
            ['3. Subprocess', 'Tier 3', '1–50 per Machine', 'Cell Formation · Surface Preparation · Welding'],
            ['4. Operation', 'Tier 4', '1–100 per Subprocess', 'Electrolyte Injection · Sheet Metal Stamping · Paint Application'],
            ['5. Elemental Task', 'Leaf', '1–500 per Operation', 'Electricity (kWh) · CO₂ emission · Welding Wire (kg)'],
          ]}
          head={['Level', 'Position', 'Typical count', 'Examples']}
        />
      </Section>

      <Section title="Driver / Flow">
        Flows are the inputs and outputs attached to a step, usually an
        operation or an elemental task. Each flow has a direction (in or out),
        a substance from the library, and an amount and unit. The engine
        multiplies the amount by the substance&apos;s factor for each category.
      </Section>

      <Section title="Assessment run">
        A snapshot in time. When you press <strong>Run the case</strong> the
        engine freezes the current tree + flows + selected method + region
        into an immutable <code>assessment_runs</code> row, then writes one{' '}
        <code>assessment_results</code> row per (component × category). Past
        runs stay as they were made, and every number on Results comes from one specific run.
      </Section>

      <Section title="Mapping to the database">
        The v3 schema names roughly match the v1 tier names. Useful when
        reading the API responses:
        <Table
          head={['Concept', 'v3 table', 'v1 equivalent']}
          rows={[
            ['Project', 'project', 'projects'],
            ['Case', 'case_table', 'system_processes (Tier 1 was the case)'],
            ['Component (any tier)', 'component (typed by component_type)', 'system / main / sub / unit / elementary_flows'],
            ['Flow', 'flows', 'driver_factors + elementary_flows'],
            ['Substance', 'substances', 'substances'],
            ['Assessment', 'assessment_runs', 'calculation_runs'],
            ['Per-component result', 'assessment_results', 'impact_results'],
            ['Impact category', 'impact_categories', 'impact_categories'],
            ['Characterisation factor', 'driver_impact_factors', 'characterization_factors'],
          ]}
        />
      </Section>
    </>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <h2 className="title" style={{ marginTop: 36, marginBottom: 10 }}>
        {title}
      </h2>
      <div
        className="body"
        style={{
          fontSize: 14,
          color: 'var(--ds-text-2)',
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </>
  )
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul
      style={{
        marginTop: 8,
        marginBottom: 12,
        paddingLeft: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {children}
    </ul>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ lineHeight: 1.6 }}>{children}</li>
}

function Table({
  head,
  rows,
}: {
  head: string[]
  rows: string[][]
}) {
  return (
    <div
      style={{
        marginTop: 14,
        border: '1px solid var(--ds-line)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${head.length}, 1fr)`,
          padding: '10px 14px',
          background: 'var(--surface-overlay)',
          fontSize: 11,
          color: 'var(--ds-text-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}
      >
        {head.map((h, i) => (
          <div key={i}>{h}</div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${head.length}, 1fr)`,
            padding: '10px 14px',
            borderTop: '1px solid var(--ds-line)',
            fontSize: 12.5,
            color: 'var(--ds-text-2)',
            gap: 8,
          }}
        >
          {row.map((cell, ci) => (
            <div key={ci}>{cell}</div>
          ))}
        </div>
      ))}
    </div>
  )
}
