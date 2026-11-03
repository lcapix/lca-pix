'use client'

// Which column is which (F2.3). Each column of the file with its first value
// and what it is read as; the person changes any of them and the file is read
// again with that choice, which the project keeps for the next file laid out
// the same way. Two places: before anything is read (the file's headers were
// not ones the reader knows), and on the review, folded, to correct a column.

import { Button } from '@/components/lcapix/ds'
import { columnsSummary, type ColumnChoice, type ColumnInfo } from '@/lib/import/columns'

export function ColumnsCard({
  info,
  choice,
  onChoose,
  onRead,
  onBack,
  reading,
  inReview,
}: {
  info: ColumnInfo
  choice: ColumnChoice
  onChoose: (header: string, field: string) => void
  onRead: () => void
  onBack?: () => void
  reading: boolean
  inReview?: boolean
}) {
  const table = (
    <table className="ip-columns-table">
      <thead>
        <tr>
          <th scope="col">Column in the file</th>
          <th scope="col">First value</th>
          <th scope="col">Read as</th>
        </tr>
      </thead>
      <tbody>
        {info.headers.map((h) => (
          <tr key={h.name}>
            <th scope="row">{h.name}</th>
            <td className="ds-mono">{h.sample || <span style={{ color: 'var(--ds-text-3)' }}>empty</span>}</td>
            <td>
              <select
                className="edu-input"
                aria-label={`What column ${h.name} holds`}
                value={choice[h.name] ?? 'ignore'}
                onChange={(e) => onChoose(h.name, e.target.value)}
              >
                <option value="ignore">Not used</option>
                {info.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  if (inReview) {
    return (
      <details className="card ip-columns" style={{ padding: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Columns · {columnsSummary(info, choice)}
          {info.source === 'saved' && <span className="edu-hint"> · as chosen before for this layout</span>}
        </summary>
        <p className="edu-hint" style={{ margin: '10px 0' }}>
          Read a column wrongly, or left one out? Say what it holds and read the file again. Your checks below start
          over, and this project remembers the choice for the next file laid out the same way.
        </p>
        {table}
        <div style={{ marginTop: 12 }}>
          <Button size="small" onClick={onRead} busy={reading}>
            Read again with these columns
          </Button>
        </div>
      </details>
    )
  }

  return (
    <section className="np-card" style={{ maxWidth: 820 }} aria-labelledby="columns-title">
      <div className="np-section">
        <h2 id="columns-title" style={{ fontSize: 20, margin: 0 }}>
          Which column is which?
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 15 }}>{info.message}</p>
        <p className="edu-hint" style={{ margin: '6px 0 12px' }}>
          Say what each column holds. It needs {info.needed}. This project remembers your choice for the next file laid
          out the same way.
        </p>
        {table}
      </div>
      <footer className="np-foot">
        <span style={{ flex: 1 }} />
        {onBack && <Button onClick={onBack}>Back</Button>}
        <Button variant="primary" onClick={onRead} busy={reading}>
          Read it with these columns →
        </Button>
      </footer>
    </section>
  )
}
