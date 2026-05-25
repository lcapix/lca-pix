'use client'

export default function FirstAssessmentPage() {
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--text-primary)' }}
      >
        Your first assessment
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}
      >
        A step-by-step walk from an empty workspace to a defensible
        per-functional-unit impact number. The sequence below mirrors the
        five phases used in the original LCAPIX user journey
        and is the same flow the v3 UI is built around.
      </p>

      <Phase
        n={1}
        title="Set up the project"
        body={
          <>
            From <Mono>/home</Mono>, click{' '}
            <Chip>+ New Project</Chip>. A project is the container for every
            scenario you&apos;ll compare. Mandatory at this stage:
            <Ul>
              <Li>
                <strong>Project name</strong> — short, distinctive (e.g.{' '}
                <em>EV Battery LCA 2025</em>).
              </Li>
              <Li>
                <strong>Functional unit</strong> — the unit of service every
                scenario is normalised to (<em>1 kWh battery capacity</em>,{' '}
                <em>1 painted box</em>). Pick this first; every scenario in
                the project must share it.
              </Li>
              <Li>
                <strong>System boundary</strong> — cradle-to-gate,
                cradle-to-grave, gate-to-gate. Determines which life-cycle
                stages you&apos;ll account for.
              </Li>
              <Li>
                <strong>Methodology + region</strong> — defaults you can
                override per run (CML 2001 / ReCiPe / TRACI · Global / US-CA
                / EU).
              </Li>
            </Ul>
          </>
        }
      />

      <Phase
        n={2}
        title="Build the base-case tree"
        body={
          <>
            Open the project, click <Chip>Add Case</Chip>, choose{' '}
            <strong>Base</strong>. Then drop a Product node and grow downward
            through the five tiers. The editor enforces parent/child rules,
            so an Elemental Task can&apos;t be a direct child of a Product.
            <CodeBlock>
{`Product           : Painted Metal Box
└─ Machine/Line   : Box Assembly
   ├─ Subprocess  : Metal Cutting
   │  └─ Operation: Sheet Metal Stamping
   │     └─ Task  : Cutting Electricity (kWh)
   └─ Subprocess  : Welding
      └─ Operation: Seam Welding
         └─ Task  : Welding Energy & Materials`}
            </CodeBlock>
            <p style={{ marginTop: 12 }}>
              Drag nodes to restructure. Right-click for clone / remove /
              import-from-library. The case auto-saves on every change — no
              explicit Save button.
            </p>
          </>
        }
      />

      <Phase
        n={3}
        title="Attach drivers to the leaves"
        body={
          <>
            Open any Elemental Task and add one or more <strong>flows</strong>
            . Each flow needs:
            <Ul>
              <Li>
                <strong>Direction</strong> — input (resource consumed) or
                output (emission / waste).
              </Li>
              <Li>
                <strong>Substance / resource</strong> — pulled from the
                Integrations &gt; Library catalog (openLCA, PubChem). Avoid
                free-text — the engine matches against
                characterisation-factor rows by substance ID.
              </Li>
              <Li>
                <strong>Quantity + unit</strong> per functional unit (e.g.{' '}
                <Mono>12.5 kWh</Mono> per painted box).
              </Li>
              <Li>
                <strong>is_driver flag</strong> on the dominant flow so the
                impact engine can roll the leaf up under one primary
                category.
              </Li>
            </Ul>
            <Tip>
              If your assessment returns 0 for a category, the cause is
              almost always a missing <Mono>is_driver</Mono> flow or a
              substance reference that didn&apos;t resolve to a
              characterisation factor.
            </Tip>
          </>
        }
      />

      <Phase
        n={4}
        title="Run an assessment"
        body={
          <>
            On the project page, with your case active, hit{' '}
            <Chip>▶ Run Assessment</Chip>. The modal asks for:
            <Ul>
              <Li>
                <strong>Valuation method</strong> — CML 2001 (default, EU
                baseline), CML-IA 2016, ReCiPe Midpoint (H) / Endpoint, TRACI
                2.1 (US EPA), EF 3.1, IPCC 2021, or EPS 2020.
              </Li>
              <Li>
                <strong>Region</strong> — used for location-specific factors
                (grid carbon, transport mixes). Global fallback otherwise.
              </Li>
            </Ul>
            The engine walks the tree depth-first, multiplies each
            flow&apos;s quantity by the matching characterisation factor for
            every category in the selected method, then rolls impacts up to
            the root. The run completes in seconds and writes one immutable{' '}
            <Mono>assessment_runs</Mono> row plus N{' '}
            <Mono>assessment_results</Mono> rows.
          </>
        }
      />

      <Phase
        n={5}
        title="Read the results"
        body={
          <>
            You land on <Chip>Results</Chip>, which has four reading lenses:
            <Ul>
              <Li>
                <strong>KPI strip</strong> — total impact, active categories,
                components assessed, last-run timestamp.
              </Li>
              <Li>
                <strong>Category tabs</strong> — switch between Global
                warming, Ozone depletion, Smog formation, Acidification,
                Particulate matter (or whatever the method emits).
              </Li>
              <Li>
                <strong>Component contribution</strong> — stacked bar that
                tells you which leaf is dominating, in percent and absolute
                terms.
              </Li>
              <Li>
                <strong>Flow-level detail</strong> — per-substance impact
                row, filterable by direction.
              </Li>
            </Ul>
            Tap <Chip>✨ Magic Insights</Chip> for a natural-language
            summary, <Chip>Export PDF</Chip> for a static deliverable, or
            jump to <Chip>Compare Cases</Chip> to overlay a comparative
            scenario.
          </>
        }
      />
    </>
  )
}

function Phase({
  n,
  title,
  body,
}: {
  n: number
  title: string
  body: React.ReactNode
}) {
  return (
    <section style={{ marginTop: 36 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'color-mix(in oklab, var(--brand-primary) 14%, transparent)',
            color: 'var(--brand-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {n}
        </span>
        <h2 className="title" style={{ margin: 0 }}>
          {title}
        </h2>
      </div>
      <div
        className="body"
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}
      >
        {body}
      </div>
    </section>
  )
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul
      style={{
        marginTop: 8,
        marginBottom: 8,
        paddingLeft: 20,
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

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="mono"
      style={{
        padding: '1px 6px',
        background: 'var(--surface-overlay)',
        borderRadius: 3,
        fontSize: 12,
      }}
    >
      {children}
    </code>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="chip chip-active" style={{ fontSize: 11 }}>
      {children}
    </span>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre
      className="mono"
      style={{
        marginTop: 12,
        marginBottom: 8,
        padding: 14,
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.55,
        color: 'var(--text-primary)',
        overflowX: 'auto',
      }}
    >
      {children}
    </pre>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <aside
      style={{
        marginTop: 14,
        padding: '12px 14px 12px 12px',
        background:
          'color-mix(in oklab, var(--brand-primary) 6%, var(--surface-raised))',
        border: '1px solid color-mix(in oklab, var(--brand-primary) 18%, var(--border-subtle))',
        borderRadius: 10,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        fontSize: 13,
        color: 'var(--text-secondary)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background:
            'color-mix(in oklab, var(--brand-primary) 20%, transparent)',
          color: 'var(--brand-primary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 700,
          marginTop: 1,
        }}
      >
        i
      </span>
      <div style={{ lineHeight: 1.6 }}>
        <span
          style={{
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginRight: 6,
          }}
        >
          Tip
        </span>
        {children}
      </div>
    </aside>
  )
}
