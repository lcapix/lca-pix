'use client'

/**
 * The two things ISO 14044's reporting clause asks of the author and no engine
 * can compute: what the result means, and what the model assumed or left out.
 * Both print in the exported report, so the report carries the author's
 * reading with the numbers under it rather than the numbers alone.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'

const MAX = 20000 // the API's cap; say so before the save fails

type Props = {
  caseId: string | number
  initialInterpretation?: string | null
  initialAssumptions?: string | null
  /** Shown as a starting point when nothing is written yet. */
  prompts?: { interpretation?: string; assumptions?: string }
  /** A "Can read" member reads the write-up; there is nothing to edit. */
  readOnly?: boolean
}

/** The write-up as text, for a member who can only read the case. */
function ReadOnlyWriteUp({
  interpretation,
  assumptions,
}: {
  interpretation: string
  assumptions: string
}) {
  const para: React.CSSProperties = { margin: '4px 0 12px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }
  const label: React.CSSProperties = { margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }
  return (
    <section
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        background: 'var(--surface-raised)',
        padding: 18,
        marginBottom: 20,
      }}
    >
      <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 650, color: 'var(--text-primary)' }}>
        The write-up
      </h3>
      <p style={label}>Interpretation</p>
      <p style={para}>{interpretation.trim() || 'Not written yet.'}</p>
      <p style={label}>Assumptions and limitations</p>
      <p style={{ ...para, marginBottom: 0 }}>{assumptions.trim() || 'Not written yet.'}</p>
    </section>
  )
}

export function WriteUpCard({
  caseId,
  initialInterpretation,
  initialAssumptions,
  prompts,
  readOnly = false,
}: Props) {
  // Collapsed by default: on a results page the numbers come first, and two
  // empty text boxes under them read like homework nobody asked for. A case
  // that already has a write-up opens showing it.
  const [open, setOpen] = useState(!!(initialInterpretation?.trim() || initialAssumptions?.trim()))
  const [interpretation, setInterpretation] = useState(initialInterpretation ?? '')
  const [assumptions, setAssumptions] = useState(initialAssumptions ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<null | 'ok'>(null)

  // The case loads after the first render, so adopt its text once it arrives,
  // but never overwrite something already typed.
  useEffect(() => {
    setInterpretation((cur) => (cur ? cur : initialInterpretation ?? ''))
    setAssumptions((cur) => (cur ? cur : initialAssumptions ?? ''))
  }, [initialInterpretation, initialAssumptions])

  const dirty =
    interpretation !== (initialInterpretation ?? '') || assumptions !== (initialAssumptions ?? '')
  const tooLong = interpretation.length > MAX || assumptions.length > MAX

  const save = async () => {
    if (tooLong) {
      toast.error(`Keep each box under ${MAX.toLocaleString()} characters`)
      return
    }
    setSaving(true)
    setSaved(null)
    try {
      const res = await apiRequest(`/api/cases/${caseId}`, {
        method: 'PUT',
        body: JSON.stringify({ interpretation, assumptions }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        toast.error(data?.error || `Could not save (${res.status})`)
        return
      }
      setSaved('ok')
      toast.success('Saved. It prints in the exported report.')
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (readOnly) {
    return <ReadOnlyWriteUp interpretation={interpretation} assumptions={assumptions} />
  }

  const box: React.CSSProperties = {
    width: '100%',
    minHeight: 96,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-base)',
    color: 'var(--text-primary)',
    fontSize: 13,
    lineHeight: 1.55,
    resize: 'vertical',
    fontFamily: 'inherit',
  }

  return (
    <section
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        background: 'var(--surface-raised)',
        padding: 18,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650, color: 'var(--text-primary)' }}>
          Your write-up
          {!open && (interpretation.trim() || assumptions.trim()) && (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              written
            </span>
          )}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Sections 7 and 8 of the exported report
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title="What the result means, and what you assumed. Both print in the report."
          >
            {open ? 'Hide' : interpretation.trim() || assumptions.trim() ? 'Show' : 'Write it'}
          </button>
        </div>
      </div>

      {!open ? null : (
      <>
      <p style={{ margin: '10px 0 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
        The engine computes the numbers. These two are yours.
      </p>

      <label
        style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}
        title="Name what drives the result, say how far the data can be trusted, and say what you would change first. Point at your own numbers."
      >
        What the result means
      </label>
      <textarea
        style={box}
        value={interpretation}
        onChange={(e) => setInterpretation(e.target.value)}
        placeholder={
          prompts?.interpretation ??
          'Which step or material carries the result, by how much, and what you would change first.'
        }
        aria-label="What the result means"
      />

      <label
        style={{ display: 'block', fontSize: 12.5, fontWeight: 600, margin: '14px 0 6px' }}
        title="What you estimated rather than measured, what you left out, and any substitute factor you used. A result a reader cannot check is not a result."
      >
        What you assumed and left out
      </label>
      <textarea
        style={box}
        value={assumptions}
        onChange={(e) => setAssumptions(e.target.value)}
        placeholder={
          prompts?.assumptions ??
          'Quantities you estimated, parts you left out, and any factor you substituted for the real material.'
        }
        aria-label="What you assumed and left out"
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={save}
          disabled={saving || tooLong || (!dirty && saved !== 'ok')}
        >
          {saving ? 'Saving…' : 'Save write-up'}
        </button>
        {tooLong && (
          <span style={{ fontSize: 12, color: 'var(--danger, #b42318)' }}>
            Too long: keep each box under {MAX.toLocaleString()} characters.
          </span>
        )}
        {!tooLong && saved === 'ok' && !dirty && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Saved. Export the report to see it in place.
          </span>
        )}
      </div>

      </>
      )}
    </section>
  )
}

export default WriteUpCard
