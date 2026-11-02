'use client'

/**
 * /library/sources (G3): where every number in LCAPIX comes from, for every
 * signed-in person. Read-only: the cost sources (BLS, EIA, Metals-API) say
 * whether they answer live on this server or the dated reference values are
 * used; the library side says which datasets the factors cite. Importing and
 * refreshing stay on the admin Integrations page.
 */

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Card, ErrorCard, TitleBlock } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { usePlatformAdmin } from '@/lib/auth/use-platform-admin'
import { REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates'
import { SOURCE_USE, groupFactorSources, shownSources, sourceState, type SourceStatus } from '@/lib/data-sources'

interface Status {
  sources: SourceStatus[]
  factorsByMethod: Array<{ method_name: string; factors: number | string }>
  factorSources: Array<{ source_reference: string | null; n: number | string }>
  substances: { total: number | string; enriched: number | string }
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never on this server')

export default function DataSourcesPage() {
  const isAdmin = usePlatformAdmin()
  const [data, setData] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    apiRequest('/api/integrations/status')
      .then(async (r) => {
        if (!r.ok) throw new Error(`The server answered ${r.status}.`)
        const d = await r.json()
        if (!d?.success) throw new Error('The answer was not in the expected shape.')
        setData(d)
      })
      .catch((e) => setError(e?.message ?? 'The data sources could not be read.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const sources = data ? shownSources(data.sources) : []
  const datasets = data ? groupFactorSources(data.factorSources ?? []) : []
  const methods = (data?.factorsByMethod ?? []).filter((m) => !String(m.method_name).startsWith('QUARANTINE'))

  return (
    <div className="np" style={{ maxWidth: 960 }}>
      <TitleBlock
        eyebrow="Library"
        title="Data sources"
        sub="Where every number in LCAPIX comes from, and whether each source is answering live on this server right now."
      />

      {error && <ErrorCard title="The data sources could not be read" cause={error} onRetry={load} retrying={loading} />}
      {loading && !data && !error && (
        <p role="status" style={{ color: 'var(--ds-text-2)' }}>
          Reading the sources…
        </p>
      )}

      {data && (
        <>
          <h2 className="ds-section-label" style={{ margin: '24px 0 10px' }}>
            Prices and wages (the cost side)
          </h2>
          <div className="srcs-grid">
            {sources
              .filter((s) => SOURCE_USE[s.id].side === 'cost')
              .map((s) => (
                <SourceCard key={s.id} s={s} />
              ))}
          </div>

          <h2 className="ds-section-label" style={{ margin: '28px 0 10px' }}>
            Impact factors (the environmental side)
          </h2>
          <Card>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ds-text-2)' }}>
              Every factor in the library cites its source. These are the datasets they come from; each factor&apos;s own source is in the{' '}
              <Link className="ds-link" href="/library/factors">
                factor library
              </Link>
              .
            </p>
            <table className="srcs-table">
              <caption className="ds-sr-only">Factors per cited dataset</caption>
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Factors
                  </th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.name}>
                    <td>{d.name}</td>
                    <td className="ds-mono" style={{ textAlign: 'right' }}>
                      {d.factors.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {methods.length > 0 && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--ds-text-3)' }}>
                By method: {methods.map((m) => `${m.method_name} ${Number(m.factors).toLocaleString()}`).join(' · ')}
              </p>
            )}
          </Card>

          <h2 className="ds-section-label" style={{ margin: '28px 0 10px' }}>
            Library imports (run by an administrator)
          </h2>
          <div className="srcs-grid">
            {sources
              .filter((s) => SOURCE_USE[s.id].side === 'library')
              .map((s) => (
                <SourceCard key={s.id} s={s} />
              ))}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--ds-text-3)' }}>
            {Number(data.substances.total).toLocaleString()} substances in the{' '}
            <Link className="ds-link" href="/library/substances">
              substance library
            </Link>
            , {Number(data.substances.enriched).toLocaleString()} enriched from PubChem.
            {isAdmin && (
              <>
                {' '}
                Imports and refreshes are on the{' '}
                <Link className="ds-link" href="/admin/integrations">
                  Integrations
                </Link>{' '}
                page.
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}

function SourceCard({ s }: { s: SourceStatus }) {
  const use = SOURCE_USE[s.id]
  const state = sourceState(s, REFERENCE_VINTAGE)
  return (
    <section className="ds-card srcs-card" aria-label={`${s.name}: ${state.word}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{s.name}</h3>
        <span className={`ds-tag ds-tag--${state.tag}`}>{state.word}</span>
      </div>
      <p style={{ margin: '8px 0 4px', fontSize: 14 }}>{use.feeds}</p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>In the app: {use.where}</p>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ds-text-2)' }}>{state.line}</p>
      <p className="ds-mono" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ds-text-3)' }}>
        Last answered: {s.events > 0 ? when(s.lastSync) : 'never on this server'}
      </p>
    </section>
  )
}
