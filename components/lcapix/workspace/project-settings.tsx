'use client'

// Project settings on the Overview (P123, P126, P127, G144): name, description,
// goal, functional unit, boundary and exclusions, default method and region,
// and, for the owner, whether AI may read the project's figures. PUT
// /api/projects/:id takes them all. After a save the header and the sidebar
// show the new values at once.

import { useState, type FormEvent } from 'react'
import { Button, SavedLine, SectionLabel } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { BOUNDARIES, METHODS, REGIONS } from '@/lib/project/study-options'
import { useShellStore } from '@/lib/shell/use-shell'

export interface SavedSettings {
  name: string
  description: string
  goalStatement: string
  functionalUnit: string
  systemBoundary: string
  boundaryNotes: string
  lciaMethod: string
  regionCode: string
  aiEnabled?: boolean
}

export function ProjectSettings({
  project,
  projectId,
  owner,
  onSaved,
}: {
  project: any
  projectId: string
  owner: boolean
  onSaved: (saved: SavedSettings) => void
}) {
  const [name, setName] = useState<string>(project.name ?? '')
  const [description, setDescription] = useState<string>(project.description ?? '')
  const [goal, setGoal] = useState<string>(project.goalStatement ?? '')
  const [unit, setUnit] = useState<string>(project.functionalUnit ?? '')
  const [boundary, setBoundary] = useState<string>(project.systemBoundary ?? 'cradle-to-gate')
  const [notes, setNotes] = useState<string>(project.boundaryNotes ?? '')
  const [method, setMethod] = useState<string>(project.lciaMethod ?? 'CML 2001')
  const [region, setRegion] = useState<string>(project.regionCode ?? 'Global')
  // G144: the switch starts on what is stored, so saving never turns AI off by accident.
  const [ai, setAi] = useState<boolean>(project.aiEnabled !== false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('The project needs a name.')
    setError(null)
    setSaved(null)
    setBusy(true)
    const body: Record<string, unknown> = {
      project_name: name.trim(),
      description: description.trim(),
      goal_statement: goal.trim(),
      functional_unit: unit.trim(),
      system_boundary: boundary,
      boundary_notes: notes.trim(),
      lcia_method: method,
      region_code: region,
    }
    if (owner) body.ai_enabled = ai
    try {
      const res = await apiRequest(`/api/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `Not saved (${res.status}).`)
      onSaved({
        name: name.trim(),
        description: description.trim(),
        goalStatement: goal.trim(),
        functionalUnit: unit.trim(),
        systemBoundary: boundary,
        boundaryNotes: notes.trim(),
        lciaMethod: method,
        regionCode: region,
        ...(owner ? { aiEnabled: ai } : {}),
      })
      void useShellStore.getState().refresh()
      setSaved('Settings saved.')
    } catch (err: any) {
      setError(err?.message ?? 'Not saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="ds-card ds-card-pad hub-settings" onSubmit={(e) => void save(e)} aria-labelledby="settings-h">
      <SectionLabel as="h2" id="settings-h">
        Project settings
      </SectionLabel>
      <label className="np-field">
        <span className="edu-field-label">Name</span>
        <input className="ds-input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="np-field">
        <span className="edu-field-label">Description</span>
        <textarea className="ds-input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="np-field">
        <span className="edu-field-label">Goal of the study</span>
        <textarea className="ds-input" value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      <label className="np-field">
        <span className="edu-field-label">Functional unit</span>
        <input className="ds-input" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </label>
      <label className="np-field">
        <span className="edu-field-label">System boundary</span>
        <select className="ds-input" value={boundary} onChange={(e) => setBoundary(e.target.value)}>
          {BOUNDARIES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <label className="np-field">
        <span className="edu-field-label">Exclusions</span>
        <textarea className="ds-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <label className="np-field">
        <span className="edu-field-label">Default method</span>
        <select className="ds-input" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="np-field">
        <span className="edu-field-label">Default region</span>
        <select className="ds-input" value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      {owner && (
        <label className="np-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} />
          <span>AI may read this project&apos;s figures (Magic Insights&apos; AI mode)</span>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {saved && <SavedLine>{saved}</SavedLine>}
      <Button type="submit" variant="primary" busy={busy}>
        Save settings
      </Button>
    </form>
  )
}
