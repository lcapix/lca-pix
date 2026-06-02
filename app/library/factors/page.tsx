'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import { AppTopBar, Icon, SectionHeader } from '@/components/lcapix'
import { useAuthStore } from '@/lib/store'
import { apiRequest } from '@/lib/api-client'

/**
 * /library/factors
 *
 * User-facing page for the LCA impact factor library. Reached from the
 * "Browse factor library" CTA on the FACTORS KPI tile on /home. Replaces the
 * previous dead-end where that tile dumped users on the admin integrations
 * dashboard with no explanation of what factors actually are.
 */

/**
 * Real prod schema (driver_impact_factors):
 *   factor_id, substance_id, category_id, method_name, factor_value, unit,
 *   geographic_scope, temporal_scope, data_quality_score, source_reference
 * Joined to substances (substance_name → driver_name) and impact_categories
 * (category_name) by the API.
 */
interface FactorRow {
  factor_id: number
  driver_name: string // surfaced from substances.substance_name
  method_name: string | null
  factor_value: string | number | null
  unit: string | null
  geographic_scope: string | null
  source_reference: string | null
  data_quality_score?: string | number | null
  category_name?: string | null
}

interface MethodGroup {
  method_name: string
  factors: number
}

export default function FactorsLibraryPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const userInitials = useMemo(
    () =>
      (user?.name ?? user?.email ?? 'U')
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [user],
  )

  const [groups, setGroups] = useState<MethodGroup[]>([])
  const [factors, setFactors] = useState<FactorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeMethod, setActiveMethod] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      apiRequest('/api/integrations/status').then((r) => r.json()).catch(() => null),
      apiRequest('/api/driver-factors').then((r) => r.json()).catch(() => null),
    ])
      .then(([status, all]) => {
        if (cancelled) return
        if (status?.success) {
          setGroups(
            (status.factorsByMethod ?? []).map((g: any) => ({
              method_name: String(g.method_name ?? g.driver_name ?? 'Unknown'),
              factors: Number(g.factors ?? 0),
            })),
          )
        }
        if (all?.success && Array.isArray(all.factors)) {
          setFactors(all.factors)
        } else if (Array.isArray(all)) {
          setFactors(all)
        }
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.message ?? 'Failed to load factor library.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const totalFactors = useMemo(
    () => groups.reduce((s, g) => s + g.factors, 0) || factors.length,
    [groups, factors],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return factors.filter((f) => {
      if (activeMethod && f.method_name !== activeMethod) return false
      if (!q) return true
      return (
        (f.driver_name ?? '').toLowerCase().includes(q) ||
        (f.method_name ?? '').toLowerCase().includes(q) ||
        (f.geographic_scope ?? '').toLowerCase().includes(q) ||
        (f.source_reference ?? '').toLowerCase().includes(q) ||
        (f.category_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [factors, activeMethod, search])

  return (
    <AuthGuard>
      <div className="app-shell">
        <AppTopBar current="integrations" userInitials={userInitials} />

        <div
          style={{
            padding: '32px 32px 80px',
            maxWidth: 1280,
            margin: '0 auto',
          }}
        >
          {/* Back */}
          <button
            onClick={() => router.push('/home')}
            className="press-active"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
              marginBottom: 16,
            }}
          >
            <Icon name="arrow-up-right" size={11} style={{ transform: 'rotate(180deg)' }} />
            Back to home
          </button>

          {/* Header */}
          <SectionHeader
            as="h1"
            eyebrow="LIBRARY"
            title="Factor library"
            sub={`${totalFactors.toLocaleString()} impact factors across ${
              groups.length ||
              new Set(factors.map((f) => f.method_name ?? '')).size
            } methodologies.`}
            style={{ marginBottom: 28 }}
          />

          {/* Explainer */}
          <div
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: '20px 22px',
              marginBottom: 28,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            <div
              className="eyebrow"
              style={{
                fontSize: 11,
                letterSpacing: '0.16em',
                color: 'var(--text-tertiary)',
                marginBottom: 8,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              WHAT IS AN IMPACT FACTOR?
            </div>
            <p style={{ margin: 0 }}>
              An <strong>impact factor</strong> tells you how much environmental
              damage one unit of a substance causes — for example, how many{' '}
              <span className="mono">kg CO₂-eq</span> are released per{' '}
              <span className="mono">kg</span> of methane emitted to air.
              LCAPIX multiplies the substance flows in your project by these
              factors to produce a total impact result.
            </p>
            <p style={{ margin: '10px 0 0' }}>
              Each factor belongs to a <strong>methodology</strong> like CML
              2001, ReCiPe Midpoint (H), or TRACI 2.1 — different scientific
              frameworks for converting emissions into impact scores. Factors
              also carry a <strong>geographic scope</strong> and{' '}
              <strong>source reference</strong> so results stay auditable.
            </p>
          </div>

          {/* Driver group chips */}
          {groups.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  color: 'var(--text-tertiary)',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                BY METHODOLOGY
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  onClick={() => setActiveMethod(null)}
                  className={'chip' + (activeMethod === null ? ' chip-active' : '')}
                  style={{
                    cursor: 'pointer',
                    border: 'none',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  All ({totalFactors})
                </button>
                {groups.map((g) => (
                  <button
                    key={g.method_name}
                    onClick={() =>
                      setActiveMethod(
                        activeMethod === g.method_name ? null : g.method_name,
                      )
                    }
                    className={
                      'chip' +
                      (activeMethod === g.method_name ? ' chip-active' : '')
                    }
                    style={{
                      cursor: 'pointer',
                      border: 'none',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {g.method_name} ({g.factors})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '0 12px',
              height: 38,
              marginBottom: 16,
              maxWidth: 420,
            }}
          >
            <Icon name="search" size={14} style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by substance, method, region, or source…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13.5,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
              }}
            />
          </div>

          {/* Table */}
          {loading ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'var(--text-tertiary)',
              }}
            >
              Loading factor library…
            </div>
          ) : error ? (
            <div
              style={{
                padding: 20,
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                color: 'var(--signal-danger, #dc2626)',
              }}
            >
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 10,
              }}
            >
              No factors match your search.
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--surface-card, #fff)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)' }}>
                    <Th>Substance</Th>
                    <Th>Method</Th>
                    <Th>Category</Th>
                    <Th align="right">Value</Th>
                    <Th>Unit</Th>
                    <Th>Region</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((f) => {
                    const v = Number(f.factor_value)
                    const display = Number.isFinite(v)
                      ? Math.abs(v) >= 0.001 && Math.abs(v) < 1000
                        ? v.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })
                        : v.toExponential(3)
                      : '—'
                    return (
                      <tr
                        key={f.factor_id}
                        style={{
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        <Td>{f.driver_name ?? '—'}</Td>
                        <Td>{f.method_name ?? '—'}</Td>
                        <Td>{f.category_name ?? '—'}</Td>
                        <Td align="right" mono>
                          {display}
                        </Td>
                        <Td mono>{f.unit ?? '—'}</Td>
                        <Td>{f.geographic_scope ?? '—'}</Td>
                        <Td>{f.source_reference ?? '—'}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <div
                  style={{
                    padding: '10px 14px',
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  Showing first 200 of {filtered.length}. Narrow the search to
                  see more.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '10px 14px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  mono = false,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  mono?: boolean
}) {
  return (
    <td
      className={mono ? 'mono' : ''}
      style={{
        textAlign: align,
        padding: '10px 14px',
        color: 'var(--text-primary)',
      }}
    >
      {children}
    </td>
  )
}
