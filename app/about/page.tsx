// app/about/page.tsx
'use client';

import { AuthGuard } from '@/components/auth-guard';
import { AppTopBar, Icon, StatusDot } from '@/components/lcapix';
import { DEMO_METHODS, DEMO_INTEGRATIONS } from '@/lib/lcapix-demo';

interface PhaseDef {
  readonly id: string;
  readonly label: string;
  readonly short: string;
  readonly color: string;
}

const LCA_PHASES: readonly PhaseDef[] = [
  { id: 'goal', label: 'Goal', short: 'G', color: 'var(--brand-primary)' },
  { id: 'inventory', label: 'Inventory', short: 'I', color: 'var(--chart-2)' },
  { id: 'impact', label: 'Impact', short: 'M', color: 'var(--text-secondary)' },
  { id: 'interpretation', label: 'Interpretation', short: 'N', color: 'var(--text-tertiary)' },
  { id: 'report', label: 'Report', short: 'R', color: 'var(--chart-5)' },
];

const SOURCE_IDS = ['openlca', 'pubchem', 'bls', 'eia'] as const;

export default function AboutPage() {
  const sources = SOURCE_IDS
    .map((id) => DEMO_INTEGRATIONS.find((i) => i.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <AuthGuard>
      <div className="app-shell">
        <AppTopBar current="home" />
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>ABOUT LCAPIX</div>
          <h1
            className="display display-lg"
            style={{ margin: 0, marginBottom: 24, color: 'var(--text-primary)' }}
          >
            What is LCAPIX?
          </h1>
          <div
            className="body"
            style={{
              fontSize: 16,
              color: 'var(--text-secondary)',
              lineHeight: 1.75,
              marginBottom: 40,
            }}
          >
            <p style={{ margin: 0, marginBottom: 16 }}>
              LCAPIX is a Life Cycle Assessment platform built for practicing sustainability
              engineers. We pair the rigor of ISO 14040/14044 with the ergonomics of a modern
              web tool.
            </p>
            <p style={{ margin: 0 }}>
              Where existing tools treat cost and environmental impact as separate analyses, we
              unify them — so an engineer can answer the question that actually lands a project:
              {' '}“for how much more, and how much less carbon?”
            </p>
          </div>

          <h2 className="headline" style={{ margin: 0, marginBottom: 16 }}>
            The methodology
          </h2>
          <div className="card-section" style={{ marginBottom: 40 }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 16,
                flexWrap: 'wrap',
                alignItems: 'stretch',
              }}
            >
              {LCA_PHASES.map((h, i) => (
                <div
                  key={h.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 4,
                      background: 'var(--surface-overlay)',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: '3px solid ' + h.color,
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: h.color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        fontWeight: 600,
                      }}
                    >
                      {h.short}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      {h.label}
                    </div>
                  </div>
                  {i < LCA_PHASES.length - 1 && (
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      <Icon name="arrow-right" size={14} />
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="body" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Every assessment follows the ISO 14040/14044 four-phase sequence, extended with a
              Report stage. Goal &amp; scope frames the question; Inventory collects flows;
              Impact assessment weights them; Interpretation checks sensitivity; Report
              communicates the verdict.
            </div>
          </div>

          <h2 className="headline" style={{ margin: 0, marginBottom: 16 }}>
            Methods we support
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 40,
            }}
          >
            {DEMO_METHODS.map((m) => (
              <div key={m.id} className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                <div
                  style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}
                >
                  {m.note}
                </div>
              </div>
            ))}
          </div>

          <h2 className="headline" style={{ margin: 0, marginBottom: 16 }}>
            Built on
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 40,
            }}
          >
            {sources.map((s) => (
              <div key={s.id} className="card" style={{ padding: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <StatusDot status={s.status} />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {s.name}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {s.description}
                </div>
              </div>
            ))}
          </div>

          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 20,
            }}
          >
            LCAPIX · ISO 14040/14044 · v1.0
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
