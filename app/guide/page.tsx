// app/guide/page.tsx: Getting started
'use client'

const kbdStyle: React.CSSProperties = {
  padding: '2px 6px',
  background: 'var(--ds-grey-bg)',
  borderRadius: 3,
  fontSize: 11,
  border: '1px solid var(--ds-line)',
}

const codeChipStyle: React.CSSProperties = {
  padding: '1px 6px',
  background: 'var(--ds-grey-bg)',
  borderRadius: 3,
  fontSize: 12,
}

export default function GettingStartedPage() {
  return (
    <>
      <div className="ds-section-label" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--ds-text)' }}
      >
        Getting started
      </h1>
      <p
        className="np-sub"
        style={{
          fontSize: 15,
          color: 'var(--ds-text-2)',
          lineHeight: 1.7,
        }}
      >
        This guide walks you from zero to your first defensible LCA result in
        under 15 minutes. You&apos;ll build a small process tree, attach flows,
        pick a method, and export a PDF.
      </p>

      <h2 className="ds-title" style={{ marginTop: 40, marginBottom: 12 }}>
        1. Create a project
      </h2>
      <p
        className="np-sub"
        style={{
          fontSize: 14,
          color: 'var(--ds-text-2)',
          lineHeight: 1.7,
        }}
      >
        From{' '}
        <span className="ds-mono" style={codeChipStyle}>
          /home
        </span>
        , click{' '}
        <span className="ds-tag" style={{ fontSize: 11 }}>
          + New project
        </span>
        . Name the study and write its question: the goal, the functional unit, the boundary, the method and the
        region. Then start from a file or start empty.
      </p>

      <h2 className="ds-title" style={{ marginTop: 40, marginBottom: 12 }}>
        2. Build the process tree
      </h2>
      <p
        className="np-sub"
        style={{
          fontSize: 14,
          color: 'var(--ds-text-2)',
          lineHeight: 1.7,
        }}
      >
        Every case starts with a Product step. Press + Add a step and choose its parent and its tier: Machine or
        line, Subprocess, Operation or Elemental task. To move a step, open its menu and choose Move, or change its
        parent in the step panel.
      </p>

      <Tip>
        Flows usually go on the lowest step, an operation or an elemental task. If a result reads zero, check that
        each flow has an amount and that the method has a factor for it: Results names every flow and category it
        left out.
      </Tip>

      <h2 className="ds-title" style={{ marginTop: 40, marginBottom: 12 }}>
        3. Run and export
      </h2>
      <p
        className="np-sub"
        style={{
          fontSize: 14,
          color: 'var(--ds-text-2)',
          lineHeight: 1.7,
        }}
      >
        Press Run the case in the case header. A small dialog asks for the method and the region, set to the
        study&apos;s. The answer opens on the case&apos;s Results tab; Open full page shows every category. Export a
        PDF, slides or a CSV from the Write-up tab or from Reports. Press{' '}
        <kbd className="ds-mono" style={kbdStyle}>
          ⌘K
        </kbd>{' '}
        to open the command palette at any time.
      </p>

      <Tip>
        Every run is kept. The full results page lists the case&apos;s runs with their method and region, and an
        older run opens as it was frozen. To set two cases side by side, use Compare.
      </Tip>
    </>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <aside
      style={{
        marginTop: 20,
        marginBottom: 32,
        padding: '14px 16px 14px 14px',
        background:
          'color-mix(in oklab, var(--ds-green) 6%, var(--ds-card))',
        border: '1px solid color-mix(in oklab, var(--ds-green) 18%, var(--ds-line))',
        borderRadius: 10,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
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
      <div
        style={{
          fontSize: 13,
          color: 'var(--ds-text-2)',
          lineHeight: 1.6,
        }}
      >
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
