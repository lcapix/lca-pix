'use client'

export default function FirstAssessmentPage() {
  return (
    <>
      <div className="ds-section-label" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--ds-text)' }}
      >
        Your first assessment
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--ds-text-2)',
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
                <strong>Project name</strong>: short, distinctive (e.g.{' '}
                <em>EV Battery LCA 2025</em>).
              </Li>
              <Li>
                <strong>Functional unit</strong>: the unit of service every
                scenario is normalised to (<em>1 kWh battery capacity</em>,{' '}
                <em>1 painted box</em>). Pick this first; every scenario in
                the project must share it.
              </Li>
              <Li>
                <strong>System boundary</strong>: cradle-to-gate,
                cradle-to-grave, gate-to-gate. Determines which life-cycle
                stages you&apos;ll account for.
              </Li>
              <Li>
                <strong>Methodology + region</strong>: defaults you can
                override per run (CML 2001 / ReCiPe Midpoint (H) / TRACI 2.1 · Global /
                United States / Europe).
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
            Open the project&apos;s Cases and press <Chip>+ New case</Chip>, then choose{' '}
            <strong>A new base case</strong>. Start from its Product step and grow downward through the five
            tiers with <Chip>+ Add a step</Chip>, choosing each step&apos;s parent and tier.
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
              To change a step, right-click it for its menu: Rename, Move to…, Add a step of the next tier
              below it, or Delete step. Deleting asks whether its steps go too.
            </p>
          </>
        }
      />

      <Phase
        n={3}
        title="Attach drivers to the leaves"
        body={
          <>
            Open a step, usually an operation or an elemental task, and add one or more{' '}
            <strong>flows</strong>. Each flow needs:
            <Ul>
              <Li>
                <strong>Direction</strong>: input (resource consumed) or
                output (emission / waste).
              </Li>
              <Li>
                <strong>Substance</strong>: picked from the substance library, which shows each
                substance&apos;s factor, unit and source. The engine reads the factor by substance, so pick one
                rather than typing a name.
              </Li>
              <Li>
                <strong>Quantity + unit</strong> per functional unit (e.g.{' '}
                <Mono>12.5 kWh</Mono> per painted box).
              </Li>

            </Ul>
            <Tip>
              If a category reads 0 or is missing, a flow has no amount, or the method has no factor for its
              substance. Results names every flow and category it left out.
            </Tip>
          </>
        }
      />

      <Phase
        n={4}
        title="Run an assessment"
        body={
          <>
            In the case, press <Chip>▶ Run Assessment</Chip>. A small dialog asks for:
            <Ul>
              <Li>
                <strong>Method</strong>: CML 2001, ReCiPe Midpoint (H) or TRACI 2.1, set to the study&apos;s.
              </Li>
              <Li>
                <strong>Region</strong>: Global, United States or Europe. Electricity has factors per region;
                anything else uses the Global factor, and Results marks it.
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
            The answer opens on the case&apos;s <Chip>Results</Chip> tab: the climate answer, what builds it,
            how sure it is, and the other categories. <Chip>Open full page</Chip> shows:
            <Ul>
              <Li>
                <strong>Every category</strong>, as bars, a radar or on a log scale.
              </Li>
              <Li>
                <strong>Cost</strong> by kind and per unit of impact, from the run.
              </Li>
              <Li>
                <strong>Steps</strong> against the base case, and where the impact sits.
              </Li>
              <Li>
                <strong>Flows</strong>: amount × factor = impact, filterable by direction.
              </Li>
            </Ul>
            Tap <Chip>✨ Magic Insights</Chip> for a plain-language summary, export a PDF from the Write-up tab
            or Reports, or open <Chip>Compare</Chip> to set cases side by side.
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
            background: 'color-mix(in oklab, var(--ds-green) 14%, transparent)',
            color: 'var(--ds-green)',
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
          color: 'var(--ds-text-2)',
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
      className="ds-mono"
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
      className="ds-mono"
      style={{
        marginTop: 12,
        marginBottom: 8,
        padding: 14,
        background: 'var(--surface-sunken)',
        border: '1px solid var(--ds-line)',
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.55,
        color: 'var(--ds-text)',
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
          'color-mix(in oklab, var(--ds-green) 6%, var(--ds-card))',
        border: '1px solid color-mix(in oklab, var(--ds-green) 18%, var(--ds-line))',
        borderRadius: 10,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        fontSize: 13,
        color: 'var(--ds-text-2)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background:
            'color-mix(in oklab, var(--ds-green) 20%, transparent)',
          color: 'var(--ds-green)',
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
            color: 'var(--ds-text)',
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
