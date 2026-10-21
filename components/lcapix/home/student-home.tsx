'use client'

// The student's Home (E13; on a phone E15): each project shared with them,
// who it is from and what they may do, the owner's cases with their answers,
// and their own case: open it, or make it (a copy of the owner's base case,
// named after them, with no runs). The sample as a small row. On a phone
// everything reads only, with the bar that says so.

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { LMS_NAME } from '@/lib/ui-flags'
import { useShellStore } from '@/lib/shell/use-shell'
import { usePhone } from '@/lib/shell/use-phone'
import { useProjectCases } from '@/lib/project/use-project-cases'
import { caseTotal, co2Unit } from '@/lib/ui/format'
import type { HomeProject } from '@/lib/home/home-view'
import { defaultCaseName, fromLine, ownCase, ownerPossessive, sharedLine, staffCases } from '@/lib/home/student-view'
import { ReadOnlyBar } from '../shell/read-only-bar'

export function StudentHome({ projects, userId, fullName }: { projects: HomeProject[]; userId: number; fullName: string | null }) {
  const phone = usePhone()
  const shared = projects.filter((p) => !p.is_sample)
  const sample = projects.find((p) => p.is_sample) ?? null
  const first = fullName?.trim().split(/\s+/)[0] ?? null
  return (
    <div className="home st" data-phone={phone || undefined}>
      <header className="home-head">
        <h1 className="ds-title">{first ? `Hi, ${first}.` : 'Hi.'}</h1>
        <p className="home-sub">{sharedLine(shared.length, LMS_NAME)}</p>
      </header>
      {shared.map((p) => (
        <SharedCard key={p.project_id} project={p} userId={userId} fullName={fullName} phone={phone} />
      ))}
      <div className="st-foot">
        {sample && (
          <div className="home-sample" style={{ flex: 1, margin: 0 }}>
            <span className="ds-flag ds-flag--sample">Sample</span>
            <span style={{ flex: 1, minWidth: 160, fontSize: 16 }}>{sample.project_name} · a finished study to read, in research order</span>
            <Link href={`/project/${sample.project_id}`} className="ds-link" style={{ fontWeight: 600 }}>
              Open
            </Link>
          </div>
        )}
        {!phone && (
          <Link href="/project/new" className="ds-link" style={{ fontWeight: 600, color: 'var(--ds-text)' }}>
            Start your own project
          </Link>
        )}
      </div>
      {phone && <ReadOnlyBar />}
    </div>
  )
}

function SharedCard({ project, userId, fullName, phone }: { project: HomeProject; userId: number; fullName: string | null; phone: boolean }) {
  const { data, error, reload } = useProjectCases(project.project_id)
  const owner = project.owner_name ?? null
  const whose = ownerPossessive(owner)

  if (error) {
    return (
      <section className="st-card" aria-label={project.project_name}>
        <div className="st-head">
          <span className="ds-section-label">Shared with you</span>
          <h2 className="st-name">{project.project_name}</h2>
          <p role="alert" className="pp-alert" style={{ marginTop: 8 }}>
            Its cases did not load: {error}.{' '}
            <button type="button" className="ds-link" onClick={() => void reload()}>
              Try again
            </button>
          </p>
        </div>
      </section>
    )
  }

  const staff = data ? new Set([data.project.owner_id, ...data.members.filter((m) => m.permission_name === 'admin').map((m) => m.user_id)]) : new Set<number>()
  const theirs = data ? staffCases(data.cases, staff) : []
  const base = theirs.find((c) => c.case_type === 'base') ?? null
  const mine = data ? ownCase(data.cases, userId) : null
  const role = data?.project.my_role ?? project.permission_name ?? null

  return (
    <section className="st-card" aria-labelledby={`st-${project.project_id}`}>
      <div className="st-head">
        <span className="ds-section-label">Shared with you</span>
        <h2 id={`st-${project.project_id}`} className="st-name">
          {project.project_name}
        </h2>
        <p className="st-from">
          {fromLine({ owner, role, fu: data?.project.functional_unit ?? null, method: data?.project.lcia_method ?? null, region: data?.project.region_code ?? null })}
        </p>
      </div>

      <div className="st-side">
        <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
          Your case
        </span>
        {!data ? null : mine ? (
          <YourCase projectId={project.project_id} kase={mine} />
        ) : role === 'viewer' ? (
          <p style={{ margin: '10px 0 0', fontSize: 16 }}>
            You can read this project. To make your own case, ask {owner ?? 'its owner'} for Can change.
          </p>
        ) : !base ? (
          <p style={{ margin: '10px 0 0', fontSize: 16 }}>{owner ?? 'The owner'} has not shared a base case to copy yet.</p>
        ) : phone ? (
          <p style={{ margin: '10px 0 0', fontSize: 16 }}>You have no case here yet. Make it on a larger screen: a copy of {whose} {base.case_name}.</p>
        ) : (
          <MakeCase projectId={project.project_id} baseId={base.case_id} baseName={base.case_name} whose={whose} defaultName={defaultCaseName(fullName)} />
        )}
      </div>
      <div className="st-cases">
        <h3 className="ds-section-label" style={{ margin: 0 }}>
          {whose} cases
        </h3>
        {!data ? (
          <p role="status" className="np-sub" style={{ margin: '10px 0 0' }}>
            Loading…
          </p>
        ) : theirs.length ? (
          <ul className="st-list">
            {theirs.map((c) => (
              <li key={c.case_id}>
                <Link href={`/project/${project.project_id}/case/${c.case_id}`} className="st-row ds-focusable">
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{c.case_name}</span>
                  {c.change ? (
                    <span className="ds-mono st-change">{c.change}</span>
                  ) : c.latest_run && !phone ? (
                    <span className="ds-mono st-run">Run #{c.latest_run.run_id}</span>
                  ) : null}
                  <span className="ds-mono st-value">{c.answer ?? 'not run'}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="np-sub" style={{ margin: '10px 0 0' }}>
            None you can see yet.
          </p>
        )}
        {!phone && (
          <Link className="ds-link" style={{ display: 'inline-block', marginTop: 18, fontWeight: 600 }} href={`/project/${project.project_id}`}>
            Read the project overview
          </Link>
        )}
      </div>

    </section>
  )
}

function YourCase({
  projectId,
  kase,
}: {
  projectId: number
  kase: { case_id: number; case_name: string; case_type: string; is_final?: boolean; latest_run: { run_id: number; headline: { value: number; unit: string } | null } | null }
}) {
  const v = kase.latest_run?.headline
  return (
    <>
      <div className="st-yours">
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: 20 }}>{kase.case_name}</strong>
          <span style={{ color: 'var(--ds-text-2)', fontSize: 15 }}>
            {kase.case_type === 'base' ? 'Base case' : 'Comparative case'} · {kase.latest_run ? `Run #${kase.latest_run.run_id}` : 'not run yet'}
          </span>
        </span>
        {v && (
          <span style={{ textAlign: 'right' }}>
            <span className="ds-mono" style={{ display: 'block', fontSize: 32, fontWeight: 600, lineHeight: 1.1 }}>
              {caseTotal(v.value, kase.case_type)}
            </span>
            <span className="ds-mono" style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>
              {co2Unit(v.unit)}
            </span>
          </span>
        )}
      </div>
      {kase.is_final ? (
        <p className="st-tick">
          <span aria-hidden>✓</span> <strong>Ticked as hand-in</strong>
          <span>A tick only. It locks nothing.</span>
        </p>
      ) : (
        <p className="st-tick" data-off>
          Not ticked as hand-in yet.
        </p>
      )}
      <Link href={`/project/${projectId}/case/${kase.case_id}`} className="ds-btn ds-btn--primary st-open">
        Open your case →
      </Link>
    </>
  )
}

function MakeCase({ projectId, baseId, baseName, whose, defaultName }: { projectId: number; baseId: number; baseName: string; whose: string; defaultName: string }) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const make = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Name your case first.')
    setBusy(true)
    setErr(null)
    try {
      const res = await apiRequest(`/api/cases/${baseId}/duplicate`, { method: 'POST', body: JSON.stringify({ case_name: name.trim() }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `The case was not made (${res.status}).`)
      void useShellStore.getState().refresh()
      router.push(`/project/${projectId}/case/${d.case_id}`)
    } catch (e2: any) {
      setErr(e2?.message ?? 'The case was not made.')
      setBusy(false)
    }
  }
  return (
    <form onSubmit={make} noValidate>
      <p className="st-none">You have no case here yet.</p>
      <p style={{ margin: '0 0 18px', fontSize: 16 }}>
        Make a copy of {whose} {baseName}. It is named after you and starts with no runs, so your first answer is your own.
      </p>
      <label style={{ display: 'grid', gap: 8 }}>
        <span className="edu-field-label">Case name</span>
        <input
          className="ds-input rp-select"
          value={name}
          maxLength={255}
          aria-invalid={!!err || undefined}
          aria-describedby={err ? 'st-make-err' : undefined}
          onChange={(e) => (setName(e.target.value), setErr(null))}
        />
      </label>
      {err && (
        <p id="st-make-err" role="alert" className="nc-error" style={{ margin: '8px 0 0' }}>
          {err}
        </p>
      )}
      <div className="pp-add">
        <Button type="submit" variant="primary" busy={busy}>
          Make your own case
        </Button>
      </div>
    </form>
  )
}
