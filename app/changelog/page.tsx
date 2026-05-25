'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { Icon } from '@/components/lcapix'
import { MarketingNav } from '@/components/lcapix/marketing-nav'

const ENTRIES = [
  {
    date: 'May 21, 2026',
    version: 'v3.4',
    tag: 'Polish',
    accent: '#006a44',
    title: 'Premium polish pass',
    body:
      'New dashboard tile system with animated counters and accent sparklines. Pastel-themed node inspector with CO₂ contribution bars. Sliding tab indicator on case views. Flagship Run Assessment animation with success glow + Magic Insights pulse. Skeleton loading states across the app. Route progress bar. All gated on prefers-reduced-motion.',
    items: [
      'Premium KPI tiles on the home dashboard',
      'Node inspector spec sheet (Option A)',
      'Sliding underline on Tree/List/Plot tabs',
      'Run Assessment flagship moment',
      'Project / Pricing / Docs / Changelog pages',
    ],
  },
  {
    date: 'May 18, 2026',
    version: 'v3.3',
    tag: 'Feature',
    accent: '#7bb5e8',
    title: 'Comp case auto-sync from base',
    body:
      'When a comparative case has no components, it now falls back to the base case tree with a "Synced from base · edit to diverge" badge. The proper workflow for LCA practitioners modeling alternatives.',
    items: [
      'Comparative case fallback',
      'Notifications + Recent Activity store',
      'Magic Insights AI summary modal',
      'Materials Pricing integration row',
    ],
  },
  {
    date: 'May 15, 2026',
    version: 'v3.2',
    tag: 'Fix',
    accent: '#f5c971',
    title: 'API schema drift fixes',
    body:
      'All 16 tested API endpoints now return 200. Fixed pm.member_id, parent_case_id, ar.run_at, flow direction aliases, driver_name lookup, and the comparison system migration.',
    items: [
      'GET /api/projects/[id]',
      'GET /api/cases/[id]',
      'GET /api/components/[id]/flows',
      'GET /api/driver-factors',
      'GET /api/comparisons',
    ],
  },
  {
    date: 'May 12, 2026',
    version: 'v3.1',
    tag: 'UI',
    accent: '#c8b5e8',
    title: 'Top-to-bottom hierarchy + auth redesign',
    body:
      'Case tree now renders top-to-bottom (was left-to-right). Auth pages redesigned with animated compare demo and trust strip.',
    items: [
      'Tree canvas reoriented',
      'Auth shell with compare demo',
      'Bigger brand mark on login',
      'Tagline: "Compare any two ways of making anything."',
    ],
  },
  {
    date: 'May 8, 2026',
    version: 'v3.0',
    tag: 'Launch',
    accent: '#f0a68a',
    title: 'LCAPIX v3 ships',
    body:
      'Next.js 15. AWS RDS production database. Multi-method assessments. ABC costing. ISO 14040/14044-aligned PDF export. The web-native rebuild of LCAPIX is live.',
    items: [
      'Next.js 15 + React',
      'AWS RDS MySQL',
      'CML 2001 · ReCiPe (H) · TRACI 2.1',
      'ABC costing engine',
      'PDF export pipeline',
    ],
  },
]

const ALL_TAGS = ['All', 'Polish', 'Feature', 'Fix', 'UI', 'Launch'] as const

export default function ChangelogPage() {
  const [activeTag, setActiveTag] = useState<(typeof ALL_TAGS)[number]>('All')
  const filtered = useMemo(
    () => (activeTag === 'All' ? ENTRIES : ENTRIES.filter((e) => e.tag === activeTag)),
    [activeTag],
  )

  return (
    <div className="app-shell page-changelog" style={{ minHeight: '100%' }}>
      <MarketingNav />

      <section style={{ padding: '96px 64px 24px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Changelog
          </div>
          <h1 className="display display-lg" style={{ margin: 0 }}>
            What's new in LCAPIX.
          </h1>
          <p
            style={{
              marginTop: 18,
              fontSize: 16,
              color: 'var(--text-secondary)',
              maxWidth: 560,
              lineHeight: 1.55,
            }}
          >
            Every feature, fix, and polish pass. We ship weekly and document everything.
          </p>

          {/* Tag filter chips */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 28,
              alignItems: 'center',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginRight: 4,
              }}
            >
              Filter:
            </span>
            {ALL_TAGS.map((tag) => {
              const active = activeTag === tag
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(tag)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: active ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    background: active ? 'oklch(from var(--brand-primary) l c h / 0.10)' : 'var(--surface-raised)',
                    color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 180ms',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section style={{ padding: '32px 64px 120px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '40px 0', fontSize: 14, color: 'var(--text-tertiary)' }}>
              No entries with that tag — yet.
            </div>
          )}
          {filtered.map((e, i) => (
            <div
              key={e.version}
              className="fade-slide-up"
              style={{
                animationDelay: `${i * 80}ms`,
                position: 'relative',
                paddingLeft: 30,
                paddingBottom: 40,
                borderLeft: '1px solid var(--border-subtle)',
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: -7,
                  top: 6,
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  background: e.accent,
                  border: '3px solid var(--surface-base)',
                  boxShadow: `0 0 0 1px ${e.accent}55`,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {e.date}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    background: 'var(--surface-overlay)',
                    borderRadius: 4,
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  {e.version}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    background: `${e.accent}22`,
                    color: e.accent,
                    borderRadius: 999,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  {e.tag}
                </span>
              </div>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: 8,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                {e.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.65,
                  margin: 0,
                  marginBottom: 14,
                }}
              >
                {e.body}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {e.items.map((it) => (
                  <li
                    key={it}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Icon name="check" size={12} style={{ color: e.accent }} />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div
            style={{
              position: 'relative',
              paddingLeft: 30,
              fontSize: 13,
              color: 'var(--text-tertiary)',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: -5,
                top: 6,
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: 'var(--surface-base)',
                border: '2px solid var(--border-subtle)',
              }}
            />
            That's all — we'll keep adding here. Follow{' '}
            <Link href="/" style={{ color: 'var(--brand-primary)' }}>
              @lcapix
            </Link>{' '}
            for shipping notes.
          </div>
        </div>
      </section>
    </div>
  )
}
