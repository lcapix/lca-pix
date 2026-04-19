// app/guide/page.tsx
'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppTopBar } from '@/components/lcapix';

interface TocItem {
  readonly id: string;
  readonly l: string;
}

const TOC: readonly TocItem[] = [
  { id: 'getting-started', l: 'Getting started' },
  { id: 'data-model', l: 'Data model' },
  { id: 'first-assessment', l: 'First assessment' },
  { id: 'glossary', l: 'Glossary' },
  { id: 'faq', l: 'FAQ' },
  { id: 'api', l: 'API reference' },
];

const kbdStyle: React.CSSProperties = {
  padding: '2px 6px',
  background: 'var(--surface-overlay)',
  borderRadius: 3,
  fontSize: 11,
  border: '1px solid var(--border-subtle)',
};

const codeChipStyle: React.CSSProperties = {
  padding: '1px 6px',
  background: 'var(--surface-overlay)',
  borderRadius: 3,
  fontSize: 12,
};

function GettingStartedBody() {
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 12 }}>GUIDE</div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--text-primary)' }}
      >
        Getting started
      </h1>
      <p
        className="body"
        style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}
      >
        This guide walks you from zero to your first defensible LCA result in under 15 minutes.
        You&apos;ll build a small process tree, attach flows, pick a method, and export a PDF.
      </p>

      <h2 className="title" style={{ marginTop: 40, marginBottom: 12 }}>
        1. Create a project
      </h2>
      <p
        className="body"
        style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}
      >
        From <span className="mono" style={codeChipStyle}>/home</span>, click{' '}
        <span className="chip chip-active" style={{ fontSize: 11 }}>+ New Project</span>. Pick a
        type — base case or comparative study.
      </p>

      <h2 className="title" style={{ marginTop: 40, marginBottom: 12 }}>
        2. Build the process tree
      </h2>
      <p
        className="body"
        style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}
      >
        Every case starts with a Product node. Add Machine/Line children, then Subprocess,
        Operation, and Elemental Task nodes. Drag to restructure.
      </p>

      <div
        style={{
          padding: 16,
          background: 'var(--surface-raised)',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          borderLeft: '3px solid var(--brand-primary)',
          marginTop: 20,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--brand-primary)',
            fontWeight: 600,
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Tip
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Flows only attach to Elemental Tasks. If your impact is zero, check that at least one
          task has an <code className="mono" style={{ padding: '1px 4px', background: 'var(--surface-overlay)', borderRadius: 3 }}>is_driver</code> flow.
        </div>
      </div>

      <h2 className="title" style={{ marginTop: 40, marginBottom: 12 }}>
        3. Run and export
      </h2>
      <p
        className="body"
        style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}
      >
        Press <kbd className="mono" style={kbdStyle}>R</kbd> to run an assessment, then{' '}
        <kbd className="mono" style={kbdStyle}>E</kbd> to export the PDF. Use{' '}
        <kbd className="mono" style={kbdStyle}>⌘K</kbd> to open the command palette at any time.
      </p>

      <div
        style={{
          padding: 16,
          background: 'var(--surface-raised)',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          borderLeft: '3px solid var(--brand-primary)',
          marginTop: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--brand-primary)',
            fontWeight: 600,
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Tip
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Every run is archived under the case&apos;s Historical runs panel — you can diff any
          two runs side-by-side without re-running the assessment.
        </div>
      </div>
    </>
  );
}

function PlaceholderBody({ label }: { label: string }) {
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 12 }}>GUIDE</div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--text-primary)' }}
      >
        {label}
      </h1>
      <p
        className="body"
        style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}
      >
        Coming soon — the full {label} reference is being prepared.
      </p>
    </>
  );
}

export default function GuidePage() {
  const [section, setSection] = useState<string>('getting-started');
  const active = TOC.find((t) => t.id === section) ?? TOC[0];

  return (
    <AuthGuard>
      <div className="app-shell">
        <AppTopBar current="home" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '240px 1fr',
            maxWidth: 1200,
            margin: '0 auto',
            minHeight: 800,
          }}
        >
          <aside
            style={{
              padding: '32px 16px',
              borderRight: '1px solid var(--border-subtle)',
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 14 }}>DOCS</div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {TOC.map((t) => {
                const isActive = section === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSection(t.id)}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      background: isActive ? 'var(--surface-raised)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 4,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 13,
                      fontFamily: 'var(--font-ui)',
                      fontWeight: isActive ? 600 : 400,
                      borderLeft:
                        '2px solid ' +
                        (isActive ? 'var(--brand-primary)' : 'transparent'),
                    }}
                  >
                    {t.l}
                  </button>
                );
              })}
            </nav>
          </aside>
          <main style={{ padding: '48px 56px', maxWidth: 720 }}>
            {section === 'getting-started' ? (
              <GettingStartedBody />
            ) : (
              <PlaceholderBody label={active.l} />
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
