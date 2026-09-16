'use client'

// ISO 14044 run summary on the results page: the goal & scope the run was
// computed under (4.2), results per functional unit (4.3.3.2), and the
// data-quality statement (4.2.3.6). Everything comes from the run snapshot,
// so it describes the run as computed even after the study is edited.

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import type { GoalScope } from '@/lib/run-snapshot'
import type { DataQualitySummary } from '@/lib/lca-engine'
import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'

const BOUNDARY_LABEL: Record<string, string> = {
  'cradle-to-gate': 'Cradle-to-gate',
  'gate-to-gate': 'Gate-to-gate',
  'cradle-to-grave': 'Cradle-to-grave',
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (a >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 3 })
  return String(Number(v.toPrecision(3)))
}

const muted: CSSProperties = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }
const numCell: CSSProperties = { textAlign: 'right', fontFamily: 'var(--font-mono)' }

function Title({ children, help }: { children: ReactNode; help: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>
      {children}
      <HelpTip label={`About ${String(children).toLowerCase()}`}>{help}</HelpTip>
    </div>
  )
}

export function IsoRunSummary({
  goalScope,
  dataQuality,
  impacts,
  editHref,
}: {
  goalScope?: GoalScope | null
  dataQuality?: DataQualitySummary | null
  impacts: Record<string, { value: number; unit: string }>
  /** Where the user edits goal & scope (the case page). */
  editHref?: string
}) {
  const scale = goalScope?.per_fu_scale ?? 1
  const unit = goalScope?.reference_flow_unit || 'unit'
  const rows = Object.entries(impacts).filter(([, v]) => Number.isFinite(v.value))

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}
    >
      <div className="card" style={{ padding: '14px 18px' }}>
        <Title help={ISO_HELP.goalScopeRun}>GOAL &amp; SCOPE</Title>
        {goalScope ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                columnGap: 14,
                rowGap: 4,
                fontSize: 12.5,
              }}
            >
              <span style={{ color: 'var(--text-tertiary)' }}>Functional unit</span>
              <span>
                {goalScope.functional_unit || (
                  <span style={{ color: '#c0392b' }}>not set when this run was made</span>
                )}
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>Reference flow</span>
              <span>
                {fmt(goalScope.reference_flow)} {unit}
                {goalScope.modeled_output !== 1
                  ? ` (data basis ${fmt(goalScope.modeled_output)} ${unit})`
                  : ''}
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>System boundary</span>
              <span>{BOUNDARY_LABEL[goalScope.system_boundary] ?? goalScope.system_boundary}</span>
              {goalScope.boundary_notes && (
                <>
                  <span style={{ color: 'var(--text-tertiary)' }}>Exclusions</span>
                  <span>{goalScope.boundary_notes}</span>
                </>
              )}
              {goalScope.goal_statement && (
                <>
                  <span style={{ color: 'var(--text-tertiary)' }}>Goal</span>
                  <span>{goalScope.goal_statement}</span>
                </>
              )}
            </div>
            {rows.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                  Per functional unit
                  <HelpTip label="How is this scaled?">{ISO_HELP.perFunctionalUnit}</HelpTip>
                </div>
                {scale === 1 ? (
                  <div style={muted}>
                    The totals above are already per functional unit (reference flow equals the
                    data basis).
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-tertiary)', textAlign: 'left' }}>
                          <th style={{ fontWeight: 500 }}>Category</th>
                          <th style={{ ...numCell, fontWeight: 500 }}>Case total</th>
                          <th style={{ ...numCell, fontWeight: 500 }}>Per FU (× {fmt(scale)})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(([name, v]) => (
                          <tr key={name} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '3px 0' }}>{name}</td>
                            <td style={numCell}>{fmt(v.value)}</td>
                            <td style={numCell}>
                              {fmt(v.value * scale)} {v.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={muted}>
            This run was made before goal &amp; scope was recorded with results. Re-run to record it.
          </div>
        )}
        {editHref && (
          <div style={{ marginTop: 10 }}>
            <Link href={editHref} style={{ fontSize: 12, color: 'var(--brand-primary)' }}>
              Edit goal &amp; scope on the case →
            </Link>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '14px 18px' }}>
        <Title help={ISO_HELP.dataQuality}>DATA QUALITY</Title>
        {dataQuality ? (
          <ul style={{ ...muted, margin: 0, paddingLeft: 18 }}>
            {dataQuality.statement.map((line, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <div style={muted}>
            This run was made before the data-quality statement was recorded. Re-run to record it.
          </div>
        )}
      </div>
    </div>
  )
}
