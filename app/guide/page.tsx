// app/guide/page.tsx — Getting started
'use client'

const kbdStyle: React.CSSProperties = {
  padding: '2px 6px',
  background: 'var(--surface-overlay)',
  borderRadius: 3,
  fontSize: 11,
  border: '1px solid var(--border-subtle)',
}

const codeChipStyle: React.CSSProperties = {
  padding: '1px 6px',
  background: 'var(--surface-overlay)',
  borderRadius: 3,
  fontSize: 12,
}

export default function GettingStartedPage() {
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--text-primary)' }}
      >
        Getting started
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}
      >
        This guide walks you from zero to your first defensible LCA result in
        under 15 minutes. You&apos;ll build a small process tree, attach flows,
        pick a method, and export a PDF.
      </p>

      <h2 className="title" style={{ marginTop: 40, marginBottom: 12 }}>
        1. Create a project
      </h2>
      <p
        className="body"
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}
      >
        From{' '}
        <span className="mono" style={codeChipStyle}>
          /home
        </span>
        , click{' '}
        <span className="chip chip-active" style={{ fontSize: 11 }}>
          + New Project
        </span>
        . Pick a type — base case or comparative study.
      </p>

      <h2 className="title" style={{ marginTop: 40, marginBottom: 12 }}>
        2. Build the process tree
      </h2>
      <p
        className="body"
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}
      >
        Every case starts with a Product node. Add Machine/Line children, then
        Subprocess, Operation, and Elemental Task nodes. Drag to restructure.
      </p>

      <Tip>
        Flows only attach to Elemental Tasks. If your impact is zero, check
        that at least one task has an{' '}
        <code
          className="mono"
          style={{
            padding: '1px 4px',
            background: 'var(--surface-overlay)',
            borderRadius: 3,
          }}
        >
          is_driver
        </code>{' '}
        flow.
      </Tip>

      <h2 className="title" style={{ marginTop: 40, marginBottom: 12 }}>
        3. Run and export
      </h2>
      <p
        className="body"
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}
      >
        Press{' '}
        <kbd className="mono" style={kbdStyle}>
          R
        </kbd>{' '}
        to run an assessment, then{' '}
        <kbd className="mono" style={kbdStyle}>
          E
        </kbd>{' '}
        to export the PDF. Use{' '}
        <kbd className="mono" style={kbdStyle}>
          ⌘K
        </kbd>{' '}
        to open the command palette at any time.
      </p>

      <Tip>
        Every run is archived under the case&apos;s Historical runs panel — you
        can diff any two runs side-by-side without re-running the assessment.
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
          'color-mix(in oklab, var(--brand-primary) 6%, var(--surface-raised))',
        border: '1px solid color-mix(in oklab, var(--brand-primary) 18%, var(--border-subtle))',
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
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
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
