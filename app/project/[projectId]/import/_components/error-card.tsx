'use client'

// A read that went wrong (F2.2b), said plainly with the ways forward that fit:
// a scanned PDF (no text to read) offers the spreadsheet version, the sample
// file, or starting empty; the hourly limit says how long to wait; anything
// else keeps the server's words. Matching assessment IDs when the server sent
// some (ITAC).

import { Button } from '@/components/lcapix/ds'
import { minutesText, type ReadFailure } from '@/lib/import/file-rules'

export function ErrorCard({
  error,
  idHints,
  failure,
  onChooseAnother,
  onTrySample,
  onStartEmpty,
}: {
  error: string
  idHints: string[]
  failure?: { kind: ReadFailure; retryAfter: number | null; fileName: string | null } | null
  onChooseAnother?: () => void
  onTrySample?: () => void
  onStartEmpty?: () => void
}) {
  const kind = failure?.kind ?? 'other'
  const title =
    kind === 'scanned'
      ? `We couldn't read ${failure?.fileName ?? 'this file'}. It looks scanned, so there is no text to read.`
      : kind === 'unreadable'
        ? `We couldn't read ${failure?.fileName ?? 'this file'}. It may be damaged or saved in an odd way.`
      : kind === 'limit'
        ? `You've used your reads for this hour. Try again in ${minutesText(failure?.retryAfter)}.`
        : kind === 'type'
          ? `${failure?.fileName ?? 'This file'} is not a type we can read.`
          : error
  return (
    <div className="ip-error" role="alert">
      <strong style={{ fontSize: 16 }}>{title}</strong>
      {kind !== 'other' && kind !== 'limit' && <span style={{ fontSize: 14 }}>{error}</span>}
      {kind === 'limit' && <span style={{ fontSize: 14 }}>The file stays chosen. Nothing was read or saved.</span>}
      {idHints.length > 0 && <span style={{ fontSize: 14 }}>Matching IDs in this workbook: {idHints.join(', ')}</span>}
      {(kind === 'scanned' || kind === 'unreadable' || kind === 'type' || kind === 'size') && (
        <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {onChooseAnother && (
            <Button variant="dark" onClick={onChooseAnother}>
              Upload the spreadsheet version
            </Button>
          )}
          {onTrySample && (
            <button type="button" className="ds-link" style={{ fontWeight: 600 }} onClick={onTrySample}>
              Try the sample file
            </button>
          )}
          {onStartEmpty && (
            <button type="button" className="ds-link" style={{ fontWeight: 600 }} onClick={onStartEmpty}>
              Start empty instead
            </button>
          )}
        </span>
      )}
    </div>
  )
}
