'use client'

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: 'My assessment came back as 0. What did I miss?',
    a: (
      <>
        Check that each flow has an amount and that the method has a factor for it. Results names every flow
        and every category it left out, and a flow with no amount is marked <strong>Needs an amount</strong> in
        the Inventory tab. Flows usually go on the lowest step, an operation or an elemental task.
      </>
    ),
  },
  {
    q: 'Can I compare more than two scenarios?',
    a: (
      <>
        Yes. Add as many copies of the base case as you need. <strong>Compare</strong> takes any cases you pick,
        ranks them in the chosen category, and reads every case against the first one, A.
      </>
    ),
  },
  {
    q: 'How do I share results without giving edit access?',
    a: (
      <>
        Export a PDF or slides from the case&apos;s Write-up tab, or from <strong>Reports</strong>. The file is the
        run as it was frozen: recipients read it without touching your data. Or add them on People with Can read.
      </>
    ),
  },
  {
    q: 'What method should I pick?',
    a: (
      <>
        Use the method your readers expect. <strong>TRACI 2.1</strong> is the US EPA method, <strong>CML 2001</strong>
        is common in European studies, and <strong>ReCiPe Midpoint (H)</strong> is a newer midpoint method. Keep one
        method for every case you compare.
      </>
    ),
  },
  {
    q: 'Why are some impact categories shown in scientific notation?',
    a: (
      <>
        Some categories (ozone depletion, certain toxicity ones) produce
        impacts that are many orders of magnitude smaller than global warming.
        Scientific notation keeps them readable. On the full results page, the category chart&apos;s{' '}
        <strong>Log scale</strong> puts them on a comparable axis.
      </>
    ),
  },
  {
    q: 'Can I undo a run?',
    a: (
      <>
        Runs are kept as they were made: the full results page lists every run of the case. You can&apos;t edit a
        past run, but you can run again at any time. To set two cases side by side, use Compare.
      </>
    ),
  },
]

export default function FaqPage() {
  return (
    <>
      <div className="ds-section-label" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--ds-text)' }}
      >
        FAQ
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--ds-text-2)',
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
              border: '1px solid var(--ds-line)',
              borderRadius: 8,
              background: 'var(--ds-card)',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ds-text)',
                listStyle: 'none',
              }}
            >
              {item.q}
            </summary>
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                color: 'var(--ds-text-2)',
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
