'use client'

// The flows editor's add form: pick a substance (search, a suggestion, a
// version, or one just added by hand), a direction, quantity and unit — or,
// for a transport substance, a leg of mass × distance — then Save flow.
// And the "add a substance" form for what the catalog does not have.

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Substance } from './flow-types'
import { matchSubstances, versionsOf, type FlowSuggestion } from './substance-search'
import { isTransportSubstance, legPayload, legState, tkmOf } from './transport-leg'
import { announceComponentsChanged, authHeaders } from './use-flows'

export function useAddFlowForm({
  componentId,
  substances,
  loadFlows,
}: {
  componentId: string
  substances: Substance[]
  loadFlows: () => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  // The process library: what a step of this kind consumes, in driver units.
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [substanceId, setSubstanceId] = useState<number | null>(null)
  const [dir, setDir] = useState<'input' | 'output'>('input')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('kg')
  // Transport-leg helper: for tonne-km substances a user shouldn't hand-compute
  // tkm. They enter mass (tonnes) and distance (km); we set quantity = t × km.
  const [legMassT, setLegMassT] = useState('')
  const [legKm, setLegKm] = useState('')

  const matches = useMemo(() => matchSubstances(search, substances), [search, substances])
  /** Versions of whatever is selected, for the one-line switcher under the picker. */
  const versionsOfSelected = useMemo(() => versionsOf(substances, substanceId), [substances, substanceId])

  const selectedSubstance = substances.find((s) => s.substance_id === substanceId)
  // A transport substance is quantified in tonne-km (freight work = mass ×
  // distance). Detect it from the catalog unit or the name so we can offer the
  // leg calculator instead of asking for a raw tkm figure.
  const isTransportLeg = isTransportSubstance(selectedSubstance)
  const { legTkm, legInUse, legInvalid } = legState(isTransportLeg, legMassT, legKm)

  /**
   * Pick a substance for the add form. A transport leg belongs to the
   * substance it was entered for (TKM-4): switching substance clears the leg,
   * and the tonne-km it produced, so it cannot carry over onto steel.
   */
  const pickSubstance = (s: Substance | null) => {
    const prev = substances.find((x) => x.substance_id === substanceId)
    const prevWasLeg = isTransportSubstance(prev)
    if ((s?.substance_id ?? null) !== substanceId) {
      if (prevWasLeg || legMassT !== '' || legKm !== '') setQty('')
      setLegMassT('')
      setLegKm('')
    }
    setSubstanceId(s?.substance_id ?? null)
    if (s?.unit) setUnit(s.unit)
  }

  /** Typing in the search box clears the pick. */
  const searchFor = (text: string) => {
    setSearch(text)
    pickSubstance(null)
  }

  const resetForm = () => {
    setAdding(false)
    setSearch('')
    setSubstanceId(null)
    setDir('input')
    setQty('')
    setUnit('kg')
    setLegMassT('')
    setLegKm('')
  }

  // Open the add form pre-filled from a suggestion. Quantity stays blank for
  // the user to fill — it's specific to their process and can't be inferred.
  const applySuggestion = (s: Pick<FlowSuggestion, 'sub' | 'dir' | 'unit'>) => {
    setAdding(true)
    pickSubstance(s.sub)
    setSearch(s.sub.substance_name)
    setDir(s.dir)
    setUnit(s.unit)
    setQty('')
  }

  /** A substance just added by hand becomes the pick. */
  const selectCreatedSubstance = (s: Substance, fallbackUnit: string) => {
    setSubstanceId(s.substance_id)
    setUnit(s.unit || fallbackUnit)
    setSearch('')
  }

  /** Quantity follows the leg while it is used; an unusable leg leaves it empty. */
  const setLeg = (massT: string, km: string) => {
    setLegMassT(massT)
    setLegKm(km)
    const tkm = tkmOf(massT, km)
    if (tkm != null) {
      setQty(String(tkm))
      setUnit('tkm')
    } else {
      setQty('')
    }
  }

  async function saveFlow() {
    if (!substanceId || !qty || isNaN(Number(qty))) return
    setSaving(true)
    try {
      const r = await fetch(`/api/components/${componentId}/flows`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          substance_id: substanceId,
          flow_type: dir,
          quantity: Number(qty),
          unit: unit.trim() || 'kg',
          // A leg is entered as mass x distance but stored as tonne-km, which
          // cannot be read back (finding #70). Keep the two numbers with it.
          ...(isTransportLeg && legTkm != null ? legPayload(legMassT, legKm) : {}),
        }),
      })
      if (r.ok) {
        toast.success('Flow added')
        resetForm()
        await loadFlows()
        // Tell the canvas/sidebar to refresh flow counts.
        announceComponentsChanged()
      } else {
        // Surfaces the server's unit-compatibility guard, among others.
        const body = await r.json().catch(() => null)
        toast.error(body?.error || 'Could not add flow')
      }
    } catch {
      toast.error('Could not add flow (network error). Nothing was saved.')
    } finally {
      setSaving(false)
    }
  }

  return {
    adding,
    setAdding,
    libraryOpen,
    setLibraryOpen,
    saving,
    search,
    searchFor,
    substanceId,
    selectedSubstance,
    matches,
    versionsOfSelected,
    pickSubstance,
    applySuggestion,
    selectCreatedSubstance,
    dir,
    setDir,
    qty,
    setQty,
    unit,
    setUnit,
    isTransportLeg,
    legMassT,
    legKm,
    legTkm,
    legInUse,
    legInvalid,
    setLeg,
    resetForm,
    saveFlow,
  }
}

export type AddFlowForm = ReturnType<typeof useAddFlowForm>

export interface NewSubstance {
  name: string
  kind: 'input' | 'emission'
  unit: string
  method: string
  impactCategory: string
  factorValue: string
  source: string
}

const blankSubstance = (method: string): NewSubstance => ({
  name: '',
  kind: 'input',
  unit: 'kg',
  method,
  impactCategory: 'Global Warming',
  factorValue: '',
  source: '',
})

/**
 * Adding a substance by hand: no library has everything, and picking
 * something "close enough" models the wrong material silently. It is the
 * user's alone, and its factor counts as unverified data until its source is
 * replaced with a published one. The impact categories load the first time
 * the form opens; the method defaults to the study's.
 */
export function useAddSubstance({
  studyMethod,
  onCreated,
}: {
  studyMethod?: string
  /** The created substance, and the unit typed (if the server sends none). */
  onCreated: (s: Substance, unit: string) => void
}) {
  const [addingSubstance, setAddingSubstance] = useState(false)
  const [newSub, setNewSub] = useState<NewSubstance>(blankSubstance('TRACI 2.1'))
  const [subError, setSubError] = useState<string | null>(null)
  const [subBusy, setSubBusy] = useState(false)
  const [impactCategories, setImpactCategories] = useState<Array<{ category_name: string; unit?: string }>>([])

  useEffect(() => {
    if (!addingSubstance || impactCategories.length) return
    ;(async () => {
      try {
        const r = await fetch('/api/impact-categories', { headers: authHeaders() })
        const d = await r.json().catch(() => ({}))
        const list = (d?.categories ?? d?.impact_categories ?? d?.data ?? []) as any[]
        setImpactCategories(list.map((c) => ({ category_name: c.category_name, unit: c.unit })))
      } catch {
        /* the form still works: the name is validated server-side */
      }
    })()
  }, [addingSubstance, impactCategories.length])

  useEffect(() => {
    if (studyMethod) setNewSub((n) => ({ ...n, method: studyMethod }))
  }, [studyMethod])

  /** "Not in the list? Add a substance": start from what was searched for. */
  const openAddSubstance = (searched: string) => {
    setSubError(null)
    setNewSub((n) => ({ ...n, name: searched.trim() || n.name }))
    setAddingSubstance(true)
  }

  const cancelAddSubstance = () => {
    setAddingSubstance(false)
    setSubError(null)
  }

  /** POST /api/substances, then use it. */
  const submitSubstance = async () => {
    setSubBusy(true)
    setSubError(null)
    try {
      const catUnit = impactCategories.find((c) => c.category_name === newSub.impactCategory)?.unit
      const r = await fetch('/api/substances', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...newSub,
          factorUnit: catUnit ? `${catUnit} / ${newSub.unit}` : undefined,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.substance) {
        setSubError(d?.error || 'Could not add the substance.')
      } else {
        onCreated(d.substance, newSub.unit)
        setAddingSubstance(false)
        setNewSub(blankSubstance(studyMethod || 'TRACI 2.1'))
      }
    } catch {
      setSubError('Could not add the substance.')
    } finally {
      setSubBusy(false)
    }
  }

  return {
    addingSubstance,
    newSub,
    setNewSub,
    subError,
    subBusy,
    impactCategories,
    openAddSubstance,
    cancelAddSubstance,
    submitSubstance,
  }
}

export type AddSubstanceForm = ReturnType<typeof useAddSubstance>
