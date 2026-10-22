import type { ReactNode } from 'react'

/** The header bar of every page that is not a case (look.md section 3). */
export function PageHeader({
  breadcrumb,
  title,
  status,
  meta,
  actions,
}: {
  breadcrumb?: ReactNode
  title: ReactNode
  status?: ReactNode
  /** A facts line beside the title ("34 cases · TRACI 2.1 · US"). */
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="ds-header">
      <div className="ds-header-titles">
        {breadcrumb && <div className="ds-breadcrumb">{breadcrumb}</div>}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="ds-title">{title}</h1>
          {meta && <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>{meta}</span>}
          {status}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  )
}

/** IBM Plex Mono 12, .08em, uppercase (YOUR CASES · 2, RECENT). */
export function SectionLabel({ children, as = 'div', id }: { children: ReactNode; as?: 'div' | 'h2' | 'h3'; id?: string }) {
  const Tag = as
  return (
    <Tag id={id} className="ds-section-label" style={{ margin: 0 }}>
      {children}
    </Tag>
  )
}

export function Card({ children, pad = true, as = 'div' }: { children: ReactNode; pad?: boolean; as?: 'div' | 'section' | 'article' }) {
  const Tag = as
  return <Tag className={`ds-card${pad ? ' ds-card-pad' : ''}`}>{children}</Tag>
}

/** Key and value list (inspector). */
export function KeyValue({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="ds-kv">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The inspector's big value: number, unit in mono, baseline aligned. */
export function BigValue({ value, unit }: { value: ReactNode; unit?: ReactNode }) {
  return (
    <div className="ds-big-value">
      <span className="ds-big-value-num">{value}</span>
      {unit && <span className="ds-big-value-unit">{unit}</span>}
    </div>
  )
}
