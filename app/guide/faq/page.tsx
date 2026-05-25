'use client'

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: 'My assessment came back as 0. What did I miss?',
    a: (
      <>
        Flows only attach to <strong>Elemental Task</strong> nodes (the leaves
        of the tree). Open the editor, find an elemental task, and make sure
        at least one driver flow is marked <code>is_driver</code>.
      </>
    ),
  },
  {
    q: 'Can I compare more than two scenarios?',
    a: (
      <>
        Yes. Add as many comparative cases as you need. Analytics overlays
        every assessed case on the radar chart; the delta panel always
        benchmarks against the first scenario.
      </>
    ),
  },
  {
    q: 'How do I share results without giving edit access?',
    a: (
      <>
        Use <strong>PDF Export</strong> on the Analytics page. The export is a
        static snapshot of the current run — recipients can read it without
        touching your data.
      </>
    ),
  },
  {
    q: 'What method should I pick?',
    a: (
      <>
        Default to <strong>CML 2001</strong> for product LCA — it&apos;s
        well-established and recognised in EPDs. Use ReCiPe when you need
        single-score endpoint indicators, or EPS if your stakeholders want a
        monetised number.
      </>
    ),
  },
  {
    q: 'Why are some impact categories shown in scientific notation?',
    a: (
      <>
        Some categories (ozone depletion, certain toxicity ones) produce
        impacts that are many orders of magnitude smaller than global warming.
        Scientific notation keeps the absolute view readable; switch to{' '}
        <strong>Log scale</strong> to see them on a comparable axis.
      </>
    ),
  },
  {
    q: 'Can I undo a run?',
    a: (
      <>
        Runs are append-only — every assessment is archived under Historical
        runs. You can&apos;t edit a past run, but you can rerun with the same
        inputs at any time, and you can always diff two runs side-by-side.
      </>
    ),
  },
]

export default function FaqPage() {
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--text-primary)' }}
      >
        FAQ
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          marginBottom: 24,
        }}
      >
        Quick answers to the questions we hear most often.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {QA.map((item, i) => (
          <details
            key={i}
            style={{
              padding: '14px 18px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              background: 'var(--surface-raised)',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                listStyle: 'none',
              }}
            >
              {item.q}
            </summary>
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}
            >
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </>
  )
}
