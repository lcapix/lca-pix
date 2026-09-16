'use client'

// /project/[projectId]/import — document ingestion with a review gate.
//
// Upload a real document (DOE ITAC workbook for now) → the server returns an
// ingestion PLAN (tree, flows with match scores + named unit conversions,
// costs, needs-review list, provenance on every fact) → the user confirms or
// edits → apply creates the case atomically. The review screen is the trust
// mechanism: accuracy comes from the document, trust comes from showing the
// mapping before anything is written.

import * as React from 'react'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { AuthGuard } from '@/components/auth-guard'
import { Icon } from '@/components/lcapix'
import type { IngestPlan, MappedFlow, SubstanceCandidate } from '@/lib/ingest/maplca'
import { placeableSteps, suggestPlacement } from '@/lib/ingest/placement'
import { LIVE_DOC_TYPES, getDocType, LAYER_LABEL } from '@/lib/ingest/doc-types'

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {}
  const t = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  if (t) h.Authorization = 'Bearer ' + t
  return h
}

const TIER_LABEL: Record<string, string> = {
  product: 'PRODUCT',
  machine_line: 'MACHINE/LINE',
  subprocess: 'SUBPROCESS',
  operation: 'OPERATION',
  elemental_task: 'TASK',
}

interface FlowEdit {
  include: boolean
  substance_id: number | null
  substance_name: string | null
  /** User unit override (item 12a) — replaces the flow's unit on apply when set.
   * Lets a held "kg CO2e" be corrected to "kg" instead of being silently dropped. */
  unit?: string
}

// Roles a reviewer can assign to an unmapped column (item 3). 'ignore' drops it;
// any other role is recorded on the case so the column is acknowledged, not lost.
const COLUMN_ROLES: Array<[string, string]> = [
  ['ignore', 'Ignore'],
  ['note', 'Keep as a note'],
  ['material', 'Material'],
  ['quantity', 'Quantity'],
  ['unit', 'Unit'],
  ['cost', 'Cost'],
  ['subassembly', 'Sub-assembly'],
]
// A routing or equipment column is never a BOM field (Tooling is not a
// material): only ignore it or keep it as a note.
const rolesFor = (connector: string): Array<[string, string]> =>
  connector === 'bom' ? COLUMN_ROLES : COLUMN_ROLES.filter(([v]) => v === 'ignore' || v === 'note')

// Bundled sample documents so a classroom user with no file of their own can
// still walk the whole flow. Inlined (not fetched) so they work offline and on
// Vercel. The header row doubles as the downloadable blank template.
// The three together are one demo product (a touring bike from a small US
// frame shop), each shaped like the real export it stands for:
//  - routing: an ERP routing (department, work center, setup / run hours,
//    base quantity for the batch oven);
//  - bom: an Oracle-style BOM (qty per, UOM, unit weight, unit cost, and the
//    Op Seq that says which step consumes each line, bulk consumables in kg);
//  - equipment: a maintenance asset register (rated power, typical load),
//    joined to the routing on the work center.
const SAMPLE_DOCS: Record<string, { filename: string; content: string }> = {
  routing: {
    filename: 'sample-routing.csv',
    content: `Op No,Operation,Department,Work Center,Setup Hrs,Run Hrs,Base Qty,Tooling
10,Cut & miter frame tubes,Fabrication,SAW-01 Cold saw,0.5,0.3,1,Tube miter jig
20,TIG weld main triangle,Fabrication,WLD-01 TIG weld cell,1.0,0.8,1,Frame fixture A
30,Weld dropouts & bosses,Fabrication,WLD-01 TIG weld cell,0.4,0.5,1,Dropout jig
40,Powder coat frame,Finishing,PNT-01 Powder booth,0.6,0.4,1,Spray gun
50,Cure coating,Finishing,OVN-01 Cure oven,0.2,0.8,2,Frame rack
60,Build & true wheels,Assembly,WHL-01 Wheel bench,0.3,0.6,1,Truing stand
70,Final assembly,Assembly,ASM-01 Assembly bench,0.5,1.0,1,Torque tools
80,QA & pack,Assembly,PCK-01 Pack station,0.2,0.3,1,Box sealer`,
  },
  bom: {
    filename: 'sample-bom.csv',
    content: `Item,Description,Material,Qty Per,UOM,Unit Weight (kg),Unit Cost,Op Seq
FT-6061,Frame tube set 6061-T6,Aluminum,1,ea,2.2,85.00,10
FR-4043-A,TIG filler rod ER4043 (main triangle),Aluminum,0.03,kg,,9.50,20
AR-TIG-A,Argon shielding gas (main triangle),Argon,0.18,kg,,,20
FR-4043-B,TIG filler rod ER4043 (dropouts and bosses),Aluminum,0.01,kg,,9.50,30
AR-TIG-B,Argon shielding gas (dropouts and bosses),Argon,0.06,kg,,,30
PC-HYB,Powder coat epoxy-polyester hybrid,Epoxy resin,0.045,kg,,12.00,40
WH-F700,Front wheel 700c (rim hub spokes),Aluminum,1,ea,0.96,45.00,60
WH-R700,Rear wheel 700c (rim hub spokes),Aluminum,1,ea,1.11,55.00,60
TR-37,Tire 37-622 wired,Rubber,2,ea,0.74,15.00,60
TB-700,Inner tube 700c,Rubber,2,ea,0.15,4.00,60
FK-4130,Fork 4130 steel,Steel,1,ea,1.02,40.00,70
CH-9,Chain 9-speed 116 links,Steel,1,ea,0.277,18.00,70
CK-110,Crankset triple,Aluminum,1,ea,0.769,45.00,70
HB-44,Handlebar 44 cm 6061-T6,Aluminum,1,ea,0.322,22.00,70
SD-B17,Saddle,Plastic,1,ea,0.52,15.00,70
PD-520,Pedals (pair),Aluminum,1,pr,0.38,12.00,70
BC-MD,Brake caliper mechanical disc,Aluminum,2,ea,0.154,30.00,70
BR-160,Brake rotor 160 mm,Stainless Steel,2,ea,0.133,15.00,70
DT-9,Derailleurs and shift levers,Aluminum,1,set,0.926,60.00,70
OC-AL,"Other aluminum parts (stem, seatpost, racks), by difference",Aluminum,1,set,1.23,60.00,70
OC-ST,"Other steel parts (cassette, headset, bottom bracket, cables), by difference",Steel,1,set,1.23,45.00,70
BX-54,Bike box corrugated 54x8x28 in,Cardboard,1,ea,3.36,6.00,80`,
  },
  equipment: {
    filename: 'sample-equipment-list.csv',
    content: `Asset ID,Description,Work Center,Rated power (kW),Typical load (%)
EQ-101,Cold saw 275 mm,SAW-01 Cold saw,1.1,50
EQ-201,AC/DC TIG welder 210 A,WLD-01 TIG weld cell,5.6,8
EQ-301,Cartridge powder booth fan,PNT-01 Powder booth,5.6,75
EQ-401,Electric batch cure oven (2 frames),OVN-01 Cure oven,5.0,62`,
  },
}

export default function ImportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [plantId, setPlantId] = useState('')
  const [connector, setConnector] = useState<string>('itac')
  // Guided intake (item 1): arriving from project creation (?first=1) selects the
  // routing connector, since the process routing builds the case skeleton. Read
  // the param in an effect, NOT a useState initializer — window is undefined
  // during SSR, so an initializer keeps the server's 'itac' after hydration
  // (the banner would show while the dropdown still said ITAC).
  const [firstDoc, setFirstDoc] = useState(false)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('first') === '1'
    ) {
      setFirstDoc(true)
      setConnector('routing')
    }
  }, [])

  // Load a bundled sample so a student with no document can still run the flow.
  const loadSample = (conn: string) => {
    const s = SAMPLE_DOCS[conn]
    if (!s) return
    setFile(new File([s.content], s.filename, { type: 'text/csv' }))
    if ((conn === 'routing' || conn === 'bom') && !plantId.trim()) setPlantId('Touring bike')
    setError(null)
    toast.success('Sample loaded — now click "Preview extraction"')
  }
  // Download the blank template (header row) for the selected connector, so a
  // student can fill in their own data in the shape we expect.
  // Read the document before trusting what came out of it: opens the sample
  // CSV in a new tab, rows and all.
  const viewSample = (conn: string) => {
    const sample = SAMPLE_DOCS[conn]
    if (!sample) return
    const url = URL.createObjectURL(new Blob([sample.content], { type: 'text/plain' }))
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  const downloadTemplate = (conn: string) => {
    const s = SAMPLE_DOCS[conn]
    if (!s) return
    const header = s.content.split('\n')[0] + '\n'
    const url = URL.createObjectURL(new Blob([header], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${conn}-template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const doc = getDocType(connector)
  // A spreadsheet routing is read deterministically; a PDF/HTML traveler goes
  // through the AI path.
  const isLLM =
    doc?.mode === 'llm' ||
    (connector === 'routing' && !!file && !/\.(csv|xlsx?|tsv)$/i.test(file.name))
  const [phase, setPhase] = useState<'pick' | 'previewing' | 'review' | 'applying' | 'done'>('pick')
  const [plan, setPlan] = useState<IngestPlan | null>(null)
  const [caseName, setCaseName] = useState('')
  const [edits, setEdits] = useState<Record<number, FlowEdit>>({})
  const [error, setError] = useState<string | null>(null)
  const [idHints, setIdHints] = useState<string[]>([])
  const [applied, setApplied] = useState<any>(null)

  // Guided assembly: append into an existing case instead of creating a new one.
  const [targetCaseId, setTargetCaseId] = useState<number | null>(null) // null = create new
  const [attachComponentId, setAttachComponentId] = useState<number | null>(null)
  const [projectCases, setProjectCases] = useState<Array<{ case_id: number; case_name: string }>>([])
  const [targetComponents, setTargetComponents] = useState<
    Array<{ component_id: number; name: string; tier: string }>
  >([])
  const [completeness, setCompleteness] = useState<any>(null)
  // Routing: units per setup, so setup time is spread per unit (setup ÷ lot).
  const [lotSize, setLotSize] = useState('')
  // Appending: the step each line goes to (keyed by its document row), plus
  // why it was suggested. A BOM does not say which step uses a part.
  const [placement, setPlacement] = useState<Record<string, number | null>>({})
  const [placementWhy, setPlacementWhy] = useState<
    Record<string, { confidence: number; reason: string }>
  >({})

  // Review interactivity (items 3, 4): dismiss individual notes / review lines,
  // and assign a role to an unmapped column so it is acknowledged not dropped.
  const [dismissedNotes, setDismissedNotes] = useState<Set<number>>(new Set())
  const [dismissedReview, setDismissedReview] = useState<Set<number>>(new Set())
  const [columnRoles, setColumnRoles] = useState<Record<string, string>>({})

  // Project-level intake status (item 10): which layers this project already has
  // across ALL its cases, and which are still missing anywhere — a running
  // checklist so the reviewer knows what document to bring next.
  // Bumped after each apply so the "added so far" bar re-reads the cases.
  const [statusTick, setStatusTick] = useState(0)
  const [projectStatus, setProjectStatus] = useState<{
    present: string[]
    missing: Array<{ layer: string; label: string; docs: string[] }>
  } | null>(null)
  useEffect(() => {
    if (projectCases.length === 0) {
      setProjectStatus(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const presentSet = new Set<string>()
      const missingMap = new Map<string, { label: string; docs: string[] }>()
      for (const c of projectCases) {
        try {
          const r = await fetch(`/api/cases/${c.case_id}/completeness`, { headers: authHeaders() })
          const d = await r.json().catch(() => ({}))
          const rep = d?.report
          if (!rep) continue
          ;(rep.present ?? []).forEach((l: string) => presentSet.add(l))
          ;(rep.missing ?? []).forEach((m: any) =>
            missingMap.set(m.layer, { label: m.label, docs: m.suggestedDocs ?? [] }),
          )
        } catch {
          /* ignore a case that fails to report */
        }
      }
      for (const l of presentSet) missingMap.delete(l)
      if (!cancelled) {
        setProjectStatus({
          present: Array.from(presentSet),
          missing: Array.from(missingMap.entries()).map(([layer, v]) => ({ layer, ...v })),
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectCases, statusTick])

  // Split the plan's notes into structured unmapped-column items (which get a
  // role picker, item 3) and plain notes (dismissible, item 4). Unmapped columns
  // are parsed out of the note text the connectors emit.
  const parsedNotes = (plan?.notes ?? []).map((note, noteIndex) => {
    const m = note.match(/^Column "([^"]+)" was read but not mapped(?: \(e\.g\. "([^"]*)"\))?/)
    return m
      ? { kind: 'column' as const, column: m[1], sample: m[2] ?? '', noteIndex }
      : { kind: 'plain' as const, note, noteIndex }
  })
  const unmappedColumns = parsedNotes.filter(
    (n): n is { kind: 'column'; column: string; sample: string; noteIndex: number } =>
      n.kind === 'column',
  )
  const plainNotes = parsedNotes.filter(
    (n): n is { kind: 'plain'; note: string; noteIndex: number } => n.kind === 'plain',
  )

  // Load this project's cases so a document can be added to an existing one.
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch(`/api/projects/${projectId}/cases`, { headers: authHeaders() })
        const d = await r.json().catch(() => ({}))
        if (Array.isArray(d?.cases)) {
          setProjectCases(
            d.cases.map((c: any) => ({
              case_id: c.case_id ?? c.id,
              case_name: c.case_name ?? c.name,
            })),
          )
        }
      } catch {
        /* ignore */
      }
    })()
  }, [projectId])

  // When appending, load the target case's nodes so the user can pick the attach point.
  useEffect(() => {
    if (!targetCaseId) {
      setTargetComponents([])
      setAttachComponentId(null)
      return
    }
    ;(async () => {
      try {
        const r = await fetch(`/api/cases/${targetCaseId}/components`, { headers: authHeaders() })
        const d = await r.json().catch(() => ({}))
        const comps = (d?.components ?? d?.data ?? []).map((c: any) => ({
          component_id: c.component_id ?? c.id,
          name: c.component_name ?? c.name,
          tier: c.component_type ?? c.tier ?? '',
        }))
        setTargetComponents(comps)
        // No silent default: each line gets its own suggested step at review.
        setAttachComponentId(null)
      } catch {
        /* ignore */
      }
    })()
  }, [targetCaseId])

  // A flow and the cost from the same document row share one placement.
  const flowKey = (f: MappedFlow, i: number) => f.provenance || `flow-${i}`
  const costKey = (c: IngestPlan['costs'][number], i: number) =>
    c.provenance ? `${c.provenance.doc} · ${c.provenance.locator}` : `cost-${i}`
  const placeSteps = placeableSteps(
    targetComponents.map((c) => ({ id: c.component_id, name: c.name, tier: c.tier })),
  )

  // Suggest a step for every line when appending (document op column > name
  // match > assembly for purchased parts > unplaced). The reviewer confirms.
  useEffect(() => {
    if (!plan || targetCaseId === null || !targetComponents.length) return
    const steps = targetComponents.map((c) => ({ id: c.component_id, name: c.name, tier: c.tier }))
    const next: Record<string, number | null> = {}
    const why: Record<string, { confidence: number; reason: string }> = {}
    const add = (
      key: string,
      line: { label?: string; material?: string; opHint?: string },
      preset?: number | null,
    ) => {
      if (key in next) return
      // The connector already joined this line to a step (an equipment list
      // matches machines to steps by work center).
      if (preset && steps.some((s) => s.id === preset)) {
        next[key] = preset
        why[key] = { confidence: 1, reason: 'same work center as the routing' }
        return
      }
      const s = suggestPlacement(line, steps)
      next[key] = s.stepId
      why[key] = { confidence: s.confidence, reason: s.reason }
    }
    plan.flows.forEach((f, i) =>
      add(
        flowKey(f, i),
        { label: f.label, material: f.substance_text, opHint: f.op_hint },
        f.attach_component_id,
      ),
    )
    plan.costs.forEach((c, i) =>
      add(costKey(c, i), { label: c.label, opHint: c.op_hint }, c.attach_component_id),
    )
    setPlacement(next)
    setPlacementWhy(why)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, targetCaseId, targetComponents])

  // Lines (applied flows + costs) with no step yet, when appending.
  const unplacedCount =
    plan && targetCaseId !== null
      ? new Set(
          [
            ...plan.flows.map((f, i) =>
              edits[i]?.include && edits[i]?.substance_id !== null ? flowKey(f, i) : null,
            ),
            ...plan.costs.map((c, i) => costKey(c, i)),
          ].filter((k): k is string => !!k && (placement[k] ?? attachComponentId) == null),
        ).size
      : 0

  const preview = async () => {
    if (!file || (connector === 'itac' && !plantId.trim())) {
      setError(
        connector === 'itac'
          ? 'Choose a file and enter an assessment ID (e.g. WV0661).'
          : 'Choose a file (.csv or .xlsx).',
      )
      return
    }
    if (connector === 'equipment' && targetCaseId === null) {
      setError('An equipment list adds energy to the steps of an existing case: choose that case under ADD TO.')
      return
    }
    setPhase('previewing')
    setError(null)
    setIdHints([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('connector', connector)
      fd.append('plant_id', plantId.trim())
      if (connector === 'routing' && Number(lotSize) > 0) fd.append('lot_size', String(Number(lotSize)))
      if (targetCaseId !== null) fd.append('target_case_id', String(targetCaseId))
      const r = await fetch('/api/ingest/preview', {
        method: 'POST',
        headers: authHeaders(false), // browser sets the multipart boundary
        body: fd,
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d?.error || 'Preview failed')
        if (Array.isArray(d?.matching_ids)) setIdHints(d.matching_ids)
        setPhase('pick')
        return
      }
      const p: IngestPlan = d.plan
      setPlan(p)
      setCaseName(p.case_name)
      const init: Record<number, FlowEdit> = {}
      p.flows.forEach((f, i) => {
        init[i] = {
          // Only a confident match is ticked; anything below 90% waits for the
          // reviewer to confirm it (nothing uncertain is applied silently).
          include: f.substance_id !== null && (f.match_score ?? 0) >= 0.9,
          substance_id: f.substance_id,
          substance_name: f.substance_name,
        }
      })
      setEdits(init)
      setDismissedNotes(new Set())
      setDismissedReview(new Set())
      setColumnRoles({})
      setPhase('review')
    } catch (e: any) {
      setError(e?.message || 'Preview failed')
      setPhase('pick')
    }
  }

  const apply = async () => {
    if (!plan) return
    const appending = targetCaseId !== null
    if (appending && unplacedCount > 0) {
      setError(
        `${unplacedCount} line(s) still need a step: pick one in the STEP column, or set a default step above.`,
      )
      return
    }
    setPhase('applying')
    setError(null)
    try {
      const flows = plan.flows
        .map((f, i) => ({ f, e: edits[i], i }))
        .filter(({ e }) => e?.include && e.substance_id !== null)
        .map(({ f, e, i }) => ({
          ...f,
          attach_component_id: appending ? placement[flowKey(f, i)] ?? attachComponentId : undefined,
          substance_id: e.substance_id,
          substance_name: e.substance_name,
          // Item 12a: honor a reviewer's unit override (e.g. "kg CO2e" → "kg").
          unit: e.unit && e.unit.trim() ? e.unit.trim() : f.unit,
        }))
      // Notes the reviewer kept (item 4), plus their unmapped-column role
      // decisions (item 3), so nothing is silently dropped and choices persist.
      const keptNotes = plan.notes.filter((_, i) => !dismissedNotes.has(i))
      const roleNotes = Object.entries(columnRoles)
        .filter(([, role]) => role && role !== 'ignore')
        .map(
          ([col, role]) =>
            `Column "${col}" — marked as ${role} by reviewer (pending a connector to map it).`,
        )
      const outNotes = [...keptNotes, ...roleNotes]
      const body = appending
        ? {
            target_case_id: targetCaseId,
            attach_component_id: attachComponentId,
            flows,
            costs: plan.costs.map((c, i) => ({
              ...c,
              attach_component_id: placement[costKey(c, i)] ?? attachComponentId,
            })),
            notes: outNotes,
          }
        : {
            project_id: Number(projectId),
            case_name: caseName.trim() || plan.case_name,
            nodes: plan.nodes,
            flows,
            costs: plan.costs,
            notes: outNotes,
          }
      const r = await fetch('/api/ingest/apply', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d?.error || 'Apply failed')
        setPhase('review')
        return
      }
      // Lines the reviewer left unticked (no match, or not confirmed) were not
      // sent, so the server cannot count them: say how many stayed out.
      setApplied({ ...d, left_out: plan.flows.length - flows.length })
      setStatusTick((t) => t + 1)
      // Make the just-created case selectable in the "Add to" picker so a
      // follow-up document can be appended to it without reloading the page.
      if (!appending && d.case_id) {
        setProjectCases((prev) =>
          prev.some((c) => c.case_id === d.case_id)
            ? prev
            : [
                ...prev,
                {
                  case_id: d.case_id,
                  case_name: caseName.trim() || plan.case_name || `Case ${d.case_id}`,
                },
              ],
        )
      }
      setPhase('done')
      toast.success(appending ? 'Document added to the case' : `Case created: ${d.case_name}`)
      // Pull the case completeness so the checklist shows what is still missing.
      try {
        const cr = await fetch(`/api/cases/${d.case_id}/completeness`, { headers: authHeaders() })
        const cd = await cr.json().catch(() => ({}))
        if (cd?.report) setCompleteness(cd.report)
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setError(e?.message || 'Apply failed')
      setPhase('review')
    }
  }

  // The STEP picker for one line when appending, with why it was suggested.
  const stepCell = (key: string) => {
    const why = placementWhy[key]
    return (
      <div>
        <select
          className="input"
          style={{ fontSize: 11.5, padding: '3px 6px', height: 28, minWidth: 190 }}
          value={placement[key] ?? ''}
          aria-label="Step this line is used at"
          onChange={(ev) => {
            const v = ev.target.value ? Number(ev.target.value) : null
            setPlacement((p) => ({ ...p, [key]: v }))
            setPlacementWhy((w) => ({
              ...w,
              [key]: { confidence: 1, reason: v ? 'chosen by you' : attachComponentId ? 'default step' : 'no step yet' },
            }))
          }}
        >
          <option value="">{attachComponentId ? '— default step —' : '— choose a step —'}</option>
          {placeSteps.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {why && (
          <div
            style={{
              fontSize: 10,
              marginTop: 2,
              color:
                why.confidence >= 0.8
                  ? 'var(--signal-success, #16a34a)'
                  : why.confidence >= 0.5
                    ? 'var(--signal-warn, #d97706)'
                    : 'var(--text-tertiary)',
            }}
          >
            {why.reason}
          </div>
        )}
      </div>
    )
  }

  const scoreColor = (s: number) =>
    s >= 0.9 ? 'var(--signal-success, #16a34a)' : s >= 0.55 ? 'var(--signal-warn, #d97706)' : 'var(--signal-error, #dc2626)'

  return (
    <AuthGuard>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px' }}>
        <div className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>
          DATA INGESTION
        </div>
        <button
          type="button"
          className="mono"
          onClick={() =>
            router.push(
              targetCaseId
                ? `/project/${projectId}/case/${targetCaseId}`
                : `/project/${projectId}`,
            )
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            padding: 0,
            marginBottom: 10,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
          }}
        >
          <Icon name="chevron-left" size={13} />
          {targetCaseId ? 'Back to the case' : 'Back to the project'}
        </button>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 600, margin: '0 0 6px' }}>
          Import a document
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.55 }}>
          Upload a real document and review the extracted process model before anything is created.
          Every value keeps a pointer to where in the document it came from; nothing uncertain is
          applied silently.
        </p>

        {error && (
          <div
            className="card"
            style={{ padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid var(--signal-error, #dc2626)', fontSize: 13 }}
          >
            {error}
            {idHints.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                Matching IDs in this workbook: {idHints.join(', ')}
              </div>
            )}
          </div>
        )}

        {(phase === 'pick' || phase === 'previewing') && firstDoc && (
          <div
            className="card"
            style={{
              padding: '12px 16px',
              marginBottom: 16,
              borderLeft: '3px solid var(--accent, #4f8a6a)',
              fontSize: 13,
            }}
          >
            <strong>Start with your process routing.</strong> A routing / bill-of-process
            document builds the case skeleton (lines → operations) that every other document
            attaches to. It's pre-selected below — upload it, or switch the type if a different
            document comes first.
          </div>
        )}

        {(phase === 'pick' || phase === 'previewing') &&
          projectStatus &&
          (projectStatus.present.length > 0 || projectStatus.missing.length > 0) && (
            <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>
                DOCUMENTS &amp; DATA ADDED SO FAR
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {projectStatus.present.length > 0 ? (
                  projectStatus.present.map((l) => (
                    <span
                      key={l}
                      className="chip"
                      style={{
                        fontSize: 11,
                        background: 'oklch(from var(--accent, #4f8a6a) l c h / 0.14)',
                      }}
                    >
                      ✓ {LAYER_LABEL[l as keyof typeof LAYER_LABEL] ?? l}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Nothing added yet. Start with the routing.
                  </span>
                )}
              </div>
              {projectStatus.missing.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Still to add:{' '}
                  {projectStatus.missing.map((m, idx) => (
                    <span key={m.layer}>
                      {idx > 0 ? ' · ' : ''}
                      <strong>{m.label}</strong>
                      {m.docs.length ? ` (${m.docs.join(' or ')})` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

        {(phase === 'pick' || phase === 'previewing') && (
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                DOCUMENT TYPE
              </label>
              <select
                className="input"
                value={connector}
                onChange={(e) => setConnector(e.target.value)}
                style={{ maxWidth: 460 }}
              >
                {LIVE_DOC_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} ({d.mode === 'structured' ? 'deterministic' : 'AI-structured'})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {doc?.provides}
                {doc?.aka?.length ? ` Also called: ${doc.aka.slice(0, 3).join(', ')}.` : ''}
                {isLLM && ' Uses an open model via Hugging Face (needs HF_TOKEN); still human-reviewed before apply.'}
              </div>
            </div>

            {/* Guided assembly: create a new case, or add this document to an
                existing one so a single case is built from several documents. */}
            <div>
              <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                ADD TO
              </label>
              <select
                className="input"
                value={targetCaseId ?? ''}
                onChange={(e) => setTargetCaseId(e.target.value ? Number(e.target.value) : null)}
                style={{ maxWidth: 460 }}
              >
                <option value="">Create a new case</option>
                {projectCases.map((c) => (
                  <option key={c.case_id} value={c.case_id}>
                    Add to: {c.case_name}
                  </option>
                ))}
              </select>
              {targetCaseId !== null && (
                <div style={{ marginTop: 8 }}>
                  <label
                    className="label"
                    style={{ display: 'block', fontSize: 11, marginBottom: 6 }}
                    title="Each line is placed on its own step on the review screen, with a suggested step and the reason. A default step here is only used for lines you leave unplaced."
                  >
                    DEFAULT STEP (OPTIONAL)
                  </label>
                  <select
                    className="input"
                    value={attachComponentId ?? ''}
                    onChange={(e) =>
                      setAttachComponentId(e.target.value ? Number(e.target.value) : null)
                    }
                    style={{ maxWidth: 460 }}
                  >
                    <option value="">— none: place each line on the review screen —</option>
                    {placeSteps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({TIER_LABEL[s.tier] ?? s.tier})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                DOCUMENT
              </label>
              <input
                type="file"
                accept={doc?.accept ?? '.xlsx'}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 13 }}
              />
              {file && (
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Selected: <strong>{file.name}</strong>
                </div>
              )}
              {SAMPLE_DOCS[connector] && (
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                    No document of your own?
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => loadSample(connector)}
                  >
                    Load a sample
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => viewSample(connector)}
                    title="Open the sample document itself in a new tab, so you can read what is being ingested"
                  >
                    View sample
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => downloadTemplate(connector)}
                    title="Download a blank CSV with the columns we expect"
                  >
                    Download blank template
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                {connector === 'itac' ? 'ASSESSMENT ID' : 'PRODUCT NAME (OPTIONAL)'}
              </label>
              <input
                className="input"
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
                placeholder={connector === 'itac' ? 'WV0661' : 'e.g. product name'}
                style={{ maxWidth: 280 }}
              />
            </div>
            {connector === 'routing' && (
              <div>
                <label
                  className="label"
                  style={{ display: 'block', fontSize: 11, marginBottom: 6 }}
                  title="How many units are made per setup. Setup time is per lot, so it is spread over the lot (setup ÷ lot size). Leave blank to keep setup out of the per-unit labor."
                >
                  LOT SIZE (OPTIONAL)
                </label>
                <input
                  className="input mono"
                  type="number"
                  min={1}
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                  placeholder="units per setup, e.g. 25"
                  style={{ maxWidth: 220 }}
                />
              </div>
            )}
            <div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={phase === 'previewing'}
                onClick={preview}
              >
                {phase === 'previewing' ? 'Reading document…' : 'Preview extraction'}
              </button>
            </div>
          </div>
        )}

        {plan && (phase === 'review' || phase === 'applying') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {targetCaseId !== null && (
              <div
                className="card"
                style={{ padding: '12px 16px', borderLeft: '3px solid var(--brand-primary)', fontSize: 12.5 }}
              >
                Adding to an existing case. Each line goes to the step in its <strong>STEP</strong>{' '}
                column, suggested from the document; change any that are wrong. Only the flows and
                costs below are added; each one keeps its source row.
                {unplacedCount > 0 && (
                  <div style={{ marginTop: 4, color: 'var(--signal-warn, #d97706)', fontWeight: 600 }}>
                    {unplacedCount} line(s) still need a step.
                  </div>
                )}
              </div>
            )}
            {targetCaseId === null && (
              <div className="card" style={{ padding: 20 }}>
                <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                  CASE NAME
                </label>
                <input
                  className="input"
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  style={{ maxWidth: 560 }}
                />
              </div>
            )}

            {/* Appending, the lines go to the case's own steps (STEP column), so
                the connector's placeholder tree would only mislead: hidden. */}
            <div
              className="card"
              style={{ padding: 20, display: targetCaseId !== null ? 'none' : undefined }}
            >
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                HIERARCHY · {plan.nodes.length} NODES
                {targetCaseId !== null ? ' (context — not created)' : ''}
              </div>
              {plan.nodes.map((n) => {
                const depth =
                  n.tier === 'product' ? 0 : n.tier === 'machine_line' ? 1 : n.tier === 'subprocess' ? 2 : n.tier === 'operation' ? 3 : 4
                return (
                  <div
                    key={n.name}
                    style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', marginLeft: depth * 22, fontSize: 12.5 }}
                  >
                    <span className="chip" style={{ fontSize: 9, padding: '1px 7px' }}>
                      {TIER_LABEL[n.tier]}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{n.name}</span>
                    {n.quantity != null && (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {Number(n.quantity).toLocaleString()} {n.unit}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                FLOWS · {plan.flows.length} EXTRACTED
              </div>
              {plan.flows.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {connector === 'routing'
                    ? 'A routing gives the steps and their hours, not materials or energy. Add the BOM for materials and the equipment list for machine energy next.'
                    : 'This document has no material or energy lines to add.'}
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 10.5 }}>
                      <th style={{ padding: '6px 8px' }}>APPLY</th>
                      <th style={{ padding: '6px 8px' }}>DOCUMENT SAYS</th>
                      <th style={{ padding: '6px 8px' }}>DIR</th>
                      <th style={{ padding: '6px 8px' }}>QUANTITY (CONVERTED)</th>
                      <th style={{ padding: '6px 8px' }}>MAPS TO SUBSTANCE</th>
                      <th style={{ padding: '6px 8px' }}>MATCH</th>
                      {targetCaseId !== null && <th style={{ padding: '6px 8px' }}>STEP</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.flows.map((f: MappedFlow, i: number) => {
                      const e = edits[i]
                      if (!e) return null
                      return (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="checkbox"
                              checked={e.include}
                              disabled={e.substance_id === null}
                              onChange={(ev) =>
                                setEdits({ ...edits, [i]: { ...e, include: ev.target.checked } })
                              }
                              aria-label={`Apply flow ${f.substance_text}`}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <div>
                              {f.label && f.label !== f.substance_text && (
                                <strong style={{ fontWeight: 600 }}>{f.label} · </strong>
                              )}
                              {f.substance_text}
                            </div>
                            <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {f.provenance}
                            </div>
                          </td>
                          <td style={{ padding: '8px', textTransform: 'uppercase', fontSize: 10.5 }}>{f.direction}</td>
                          <td style={{ padding: '8px' }}>
                            <span className="mono">
                              {Number(f.quantity).toLocaleString()} {f.unit}
                            </span>
                            {f.conversion_note && (
                              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                {f.conversion_note}
                              </div>
                            )}
                            {f.unit_compatible === false && (
                              <div style={{ marginTop: 2 }}>
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    color: 'var(--signal-error, #dc2626)',
                                    fontWeight: 600,
                                  }}
                                >
                                  ⚠ unit won't convert to this substance — will be held
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 4,
                                    alignItems: 'center',
                                    marginTop: 3,
                                  }}
                                >
                                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                    override unit:
                                  </span>
                                  <input
                                    className="input mono"
                                    style={{ height: 24, fontSize: 11, width: 74 }}
                                    placeholder={f.unit}
                                    value={e.unit ?? ''}
                                    onChange={(ev) =>
                                      setEdits({ ...edits, [i]: { ...e, unit: ev.target.value } })
                                    }
                                    aria-label="Override unit"
                                  />
                                  <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>
                                    e.g. "kg" for "kg CO2e"
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <select
                              className="input"
                              style={{ fontSize: 12, padding: '4px 8px', minWidth: 200 }}
                              value={e.substance_id ?? ''}
                              onChange={(ev) => {
                                const sid = ev.target.value ? Number(ev.target.value) : null
                                const cand = f.candidates.find((c: SubstanceCandidate) => c.substance_id === sid)
                                setEdits({
                                  ...edits,
                                  [i]: {
                                    include: sid !== null,
                                    substance_id: sid,
                                    substance_name: cand?.substance_name ?? null,
                                  },
                                })
                              }}
                            >
                              <option value="">— hold for review (not applied) —</option>
                              {f.candidates.map((c: SubstanceCandidate) => (
                                <option key={c.substance_id} value={c.substance_id}>
                                  {c.substance_name} · match {(c.score * 100).toFixed(0)}%
                                  {c.factor_count === 0 ? ' · NO IMPACT DATA' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span
                              className="mono"
                              style={{ fontSize: 11, fontWeight: 600, color: scoreColor(f.match_score) }}
                            >
                              {(f.match_score * 100).toFixed(0)}%
                            </span>
                          </td>
                          {targetCaseId !== null && (
                            <td style={{ padding: '8px' }}>{stepCell(flowKey(f, i))}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {plan.costs.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                  COSTS · {plan.costs.length} LINES
                </div>
                {plan.costs.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '3px 0', fontSize: 12.5, alignItems: 'baseline' }}>
                    <span className="mono" style={{ minWidth: 110 }}>
                      ${Number(c.amount).toLocaleString()}
                    </span>
                    <span className="chip" style={{ fontSize: 9, padding: '1px 7px' }}>{c.category}</span>
                    {targetCaseId !== null ? (
                      stepCell(costKey(c, i))
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>{c.node}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({c.basis})</span>
                  </div>
                ))}
              </div>
            )}

            {plan.review.filter((_, i) => !dismissedReview.has(i)).length > 0 && (
              <div
                className="card"
                style={{ padding: 20, borderLeft: '3px solid var(--signal-warn, #d97706)' }}
              >
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                  NEEDS HUMAN REVIEW
                </div>
                {plan.review.map((r, i) =>
                  dismissedReview.has(i) ? null : (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'baseline',
                        fontSize: 12.5,
                        padding: '3px 0',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setDismissedReview((s) => new Set(s).add(i))}
                        title="Dismiss — I've handled this"
                        aria-label="Dismiss review item"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-tertiary)',
                          fontSize: 14,
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                      <span>! {r}</span>
                    </div>
                  ),
                )}
              </div>
            )}

            {unmappedColumns.filter((c) => !dismissedNotes.has(c.noteIndex)).length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                  UNMAPPED COLUMNS · assign a role so nothing is dropped
                </div>
                {unmappedColumns.map((c) =>
                  dismissedNotes.has(c.noteIndex) ? null : (
                    <div
                      key={c.column}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        padding: '6px 0',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setDismissedNotes((s) => new Set(s).add(c.noteIndex))}
                        title="Ignore this column"
                        aria-label={`Ignore column ${c.column}`}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-tertiary)',
                          fontSize: 14,
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.column}</span>
                      {c.sample && (
                        <span
                          className="mono"
                          style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}
                        >
                          e.g. "{c.sample}"
                        </span>
                      )}
                      <select
                        className="input"
                        style={{ fontSize: 11, padding: '3px 6px', height: 26 }}
                        value={columnRoles[c.column] ?? 'ignore'}
                        onChange={(ev) =>
                          setColumnRoles((r) => ({ ...r, [c.column]: ev.target.value }))
                        }
                        aria-label={`Role for column ${c.column}`}
                      >
                        {rolesFor(connector).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {(columnRoles[c.column] ?? 'ignore') !== 'ignore' && (
                        <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                          recorded on the case — add the matching connector to map it
                        </span>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}

            {plainNotes.filter((n) => !dismissedNotes.has(n.noteIndex)).length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {plainNotes.map((n) =>
                  dismissedNotes.has(n.noteIndex) ? null : (
                    <div
                      key={n.noteIndex}
                      style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '2px 0' }}
                    >
                      <button
                        type="button"
                        onClick={() => setDismissedNotes((s) => new Set(s).add(n.noteIndex))}
                        title="Dismiss note"
                        aria-label="Dismiss note"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-tertiary)',
                          fontSize: 14,
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                      <span>NOTE: {n.note}</span>
                    </div>
                  ),
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={phase === 'applying' || unplacedCount > 0}
                title={unplacedCount > 0 ? `${unplacedCount} line(s) still need a step` : undefined}
                onClick={apply}
              >
                {phase === 'applying'
                  ? targetCaseId !== null
                    ? 'Adding…'
                    : 'Creating case…'
                  : targetCaseId !== null
                    ? 'Apply — add to case'
                    : 'Apply — create this case'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPlan(null)
                  setPhase('pick')
                }}
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && applied && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="check" size={16} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                {applied.appended ? 'Document added to the case' : 'Case created from document'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {applied.appended
                ? `${applied.flows_applied} flows added across ${(applied.steps_used ?? []).length} step(s)${
                    (applied.steps_used ?? []).length ? ` (${applied.steps_used.join(', ')})` : ''
                  } · ${applied.flows_held_for_review} held for review${
                    applied.left_out ? ` · ${applied.left_out} left out at review` : ''
                  } · ${applied.cost_columns_updated} cost entries updated`
                : `${applied.components_created} steps created · ${applied.flows_applied} inputs and outputs added · ${applied.flows_held_for_review} held for review${
                    applied.left_out ? ` · ${applied.left_out} left out at review` : ''
                  } · costs on ${applied.cost_nodes} steps`}
            </div>
            {Array.isArray(applied.held_details) && applied.held_details.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                {applied.held_details.map((h: string, i: number) => (
                  <div key={i}>held: {h}</div>
                ))}
              </div>
            )}

            {/* Case completeness — which layers are present, what to add next. */}
            {completeness && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                  DOCUMENTS &amp; DATA ADDED
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {(completeness.present ?? []).map((layer: string) => (
                    <span
                      key={layer}
                      className="chip"
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        background: 'color-mix(in oklab, var(--signal-success, #16a34a) 12%, transparent)',
                        color: 'var(--signal-success, #16a34a)',
                      }}
                    >
                      ✓ {LAYER_LABEL[layer as keyof typeof LAYER_LABEL] ?? layer}
                    </span>
                  ))}
                </div>
                {(completeness.missing ?? []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {completeness.missing.map((m: any) => (
                      <div key={m.layer} style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600 }}>Still to add: {m.label}</span>
                        {m.suggestedDocs?.length
                          ? ` — from a ${m.suggestedDocs.slice(0, 2).join(' or ')}`
                          : ' — no document type for this yet; enter it by hand on the step that uses it'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(completeness?.missing ?? []).length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    // Continue assembling THIS case with the next document:
                    // the one that fills the first layer still missing.
                    const ids = (completeness?.missing ?? [])
                      .flatMap((m: any) => m.suggestedDocs ?? [])
                      .map((label: string) => LIVE_DOC_TYPES.find((d) => d.label === label)?.id)
                      .filter(Boolean) as string[]
                    const next = ['bom', 'equipment', 'itac'].find((id) => ids.includes(id))
                    if (next) setConnector(next)
                    setFirstDoc(false)
                    setTargetCaseId(applied.case_id)
                    setPlan(null)
                    setApplied(null)
                    setEdits({})
                    setFile(null)
                    setPlantId('')
                    setPhase('pick')
                  }}
                >
                  Add another document to this case
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => router.push(`/project/${projectId}/case/${applied.case_id}`)}
              >
                Open case
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPlan(null)
                  setApplied(null)
                  setEdits({})
                  setFile(null)
                  setPlantId('')
                  setTargetCaseId(null)
                  setCompleteness(null)
                  setPhase('pick')
                }}
              >
                Start a new case
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
