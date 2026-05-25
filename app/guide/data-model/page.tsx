'use client'

export default function DataModelPage() {
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--text-primary)' }}
      >
        Data model
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}
      >
        Every LCA in LCAPIX is organised around a strict five-tier process
        tree, inherited from the original v1 desktop platform and preserved
        across v2/v3. The hierarchy mirrors how an LCA practitioner actually
        decomposes a system — from the whole product down to the individual
        elementary flows that the impact engine consumes.
      </p>

      <Section title="Project">
        Top-level container. Owns a name, description, methodology default
        (e.g. ISO 14040), valuation method (e.g. EPS or ReCiPe), status, and
        members. Multiple cases live inside one project — typically one base
        case plus N comparatives sharing the same functional unit.
      </Section>

      <Section title="Case">
        A single scenario within the project. Two types:
        <Ul>
          <Li>
            <strong>Base case</strong> — the reference scenario (the as-is
            production line, the existing material mix, the current grid).
          </Li>
          <Li>
            <strong>Comparative case</strong> — an alternative being
            evaluated. Inherits the same functional unit as the base; only the
            substitutions you care about should differ.
          </Li>
        </Ul>
        Cases store name, description, type, parent project, and (once
        assessed) one or more <em>assessment runs</em>.
      </Section>

      <Section title="Five-tier process tree">
        Every case rolls up from a single Product node through Machine/Line,
        Subprocess, Operation, and Elemental Task leaves. Quantities and
        constraints below are the v1 defaults — v3 enforces them as soft
        limits, not hard cut-offs.
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
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            marginTop: 12,
            lineHeight: 1.6,
          }}
        >
          Required fields tighten as you descend: a Product needs a functional
          unit and reference flow; a Machine needs capacity and location; an
          Operation needs parameters; and an Elemental Task needs a
          direction, substance/resource, quantity, unit, and impact-category
          mapping.
        </p>
      </Section>

      <Section title="Driver / Flow">
        Drivers are the inputs and outputs attached to an Elemental Task.
        Each flow has a direction (input / output), a substance or resource
        reference, a quantity and unit, and an optional <code>is_driver</code>{' '}
        flag that promotes it to the primary impact driver for that task.
        Flows are how the calculation engine knows what to multiply against
        characterisation factors.
      </Section>

      <Section title="Assessment run">
        A snapshot in time. When you press <strong>Run Assessment</strong> the
        engine freezes the current tree + flows + selected method + region
        into an immutable <code>assessment_runs</code> row, then writes one{' '}
        <code>assessment_results</code> row per (component × category). Past
        runs stay forever — you can diff any two without re-running, and
        every chart on the Results page is sourced from a specific run.
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
            ['Driver / flow', 'component.drivers (JSON)', 'driver_factors + elementary_flows'],
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
          color: 'var(--text-secondary)',
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
        border: '1px solid var(--border-subtle)',
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
          color: 'var(--text-tertiary)',
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
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 12.5,
            color: 'var(--text-secondary)',
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
