'use client'

// The inspector's number inputs, typed as text (EDIT-5). The raw text is kept
// per node while typing; a draft is shown only while the form still holds the
// value it produced, so a value applied from elsewhere (Suggest, the
// calculators, another node) wins. Save is refused while a draft is invalid.

import { useState } from 'react'
import { numberDraftError, parseNumberDraft, type NumberDraft, type NumberFieldKey } from './number-draft'
import type { InspectorEditFormData } from './types'

export function useNumberDrafts({
  nodeId,
  editFormData,
  onChange,
}: {
  nodeId: string | null
  editFormData?: InspectorEditFormData
  onChange?: (patch: Partial<InspectorEditFormData>) => void
}) {
  const [drafts, setDrafts] = useState<{ nodeId: string | null; map: Record<string, NumberDraft> }>({
    nodeId: null,
    map: {},
  })
  const [saveBlocked, setSaveBlocked] = useState(false)
  const controlled = !!editFormData && !!onChange

  const draftMap = drafts.nodeId === nodeId ? drafts.map : {}
  const activeDraft = (key: NumberFieldKey): NumberDraft | null => {
    const d = draftMap[key]
    return d && Object.is(d.sent, editFormData?.[key] as number | undefined) ? d : null
  }

  /** What the input shows: the draft while it is current, else the form value. */
  const numberValue = (key: NumberFieldKey): string => {
    const d = activeDraft(key)
    if (d) return d.raw
    const v = editFormData?.[key] as number | undefined
    return v == null ? '' : String(v)
  }

  /** The inline message under the input, or null. */
  const numberError = (key: NumberFieldKey): string | null => {
    const d = activeDraft(key)
    return d ? numberDraftError(key, d.raw) : null
  }

  /** Keep what was typed; send it to the form when it parses. */
  const onNumberChange = (key: NumberFieldKey, raw: string) => {
    if (!controlled) return
    let sent = editFormData![key] as number | undefined
    if (numberDraftError(key, raw) === null) {
      const p = parseNumberDraft(raw)
      if (p.ok) {
        sent = p.value
        onChange!({ [key]: p.value } as Partial<InspectorEditFormData>)
      }
    }
    setSaveBlocked(false)
    setDrafts({ nodeId, map: { ...draftMap, [key]: { raw, sent } } })
  }

  const invalidNumbers = (Object.keys(draftMap) as NumberFieldKey[]).some(
    (k) => numberError(k) !== null,
  )

  /** Save, unless a number is invalid; then say so ("Fix the highlighted number first."). */
  const guardSave = (onSave: () => void) => {
    if (invalidNumbers) {
      setSaveBlocked(true)
      return
    }
    onSave()
  }

  return { numberValue, numberError, onNumberChange, invalidNumbers, saveBlocked, guardSave }
}

export type NumberDrafts = ReturnType<typeof useNumberDrafts>
