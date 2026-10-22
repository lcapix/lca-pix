'use client'

// The six exercises (behaviour spec "Sequence" 3, E04 "Exercise 3 of 6 ·
// Energy", E05 the prediction, E06 "Exercise 6 of 6 · Write it up"): the
// guide's one card at the top of the panel, with Guided mode on, on a case
// the person can change. Each exercise is a task done in the real workspace,
// a check that reads the case's own data, and one question. Exercise 4 asks
// for a prediction before the first run and reveals it honestly after.
// Answers are saved on the case (learning_state), so they follow the person.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Flag } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useGuidedMode } from '@/lib/shell/use-shell'
import {
  LESSONS,
  numberIsRight,
  parseLearningState,
  progress,
  type LearningState,
  type LessonFacts,
  type LessonId,
} from '@/lib/lessons'

interface ExerciseCtx {
  facts: LessonFacts
  state: LearningState
  save: (next: LearningState) => Promise<void>
  /** The exercise just answered: it stays on screen with its reason until Next. */
  reviewing: LessonId | null
  setReviewing: (id: LessonId | null) => void
  /** The operations a prediction can name, and the step the latest run puts first. */
  operations: string[]
  topStep: { name: string; share: string } | null
}

const Ctx = createContext<ExerciseCtx | null>(null)

export function ExerciseProvider({
  caseId,
  initial,
  facts,
  operations,
  topStep,
  onSaved,
  children,
}: {
  caseId: number
  initial: unknown
  facts: LessonFacts
  operations: string[]
  topStep: { name: string; share: string } | null
  onSaved?: () => void
  children: ReactNode
}) {
  const [state, setState] = useState<LearningState>(() => parseLearningState(initial))
  const [reviewing, setReviewing] = useState<LessonId | null>(null)
  useEffect(() => setState(parseLearningState(initial)), [initial])
  const save = async (next: LearningState) => {
    setState(next)
    const res = await apiRequest(`/api/cases/${caseId}`, { method: 'PUT', body: JSON.stringify({ learning_state: next }) })
    if (res.ok) onSaved?.()
  }
  const value = useMemo(
    () => ({ facts, state, save, reviewing, setReviewing, operations, topStep }),
    [facts, state, reviewing, operations, topStep], // eslint-disable-line react-hooks/exhaustive-deps
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const TITLE: Record<LessonId, string> = {
  scope: 'Goal and scope',
  inventory: 'Materials',
  energy: 'Energy',
  impact: 'Prediction',
  compare: 'Compare',
  handin: 'Write it up',
}

/**
 * The guide's card for this case, or `fallback` (the scripted guide line) when
 * there are no exercises here: Guided mode off, no provider (a case the person
 * cannot change), or all six done.
 */
export function ExerciseSlot({ fallback = null }: { fallback?: ReactNode }) {
  const ctx = useContext(Ctx)
  const [guided, setGuided] = useGuidedMode()
  if (!guided) return null
  if (!ctx) return <>{fallback}</>
  const { current: next, doneCount, total } = progress(ctx.facts, ctx.state)
  // The one just answered stays until Next; then the first exercise not done.
  const current = (ctx.reviewing && LESSONS.find((l) => l.id === ctx.reviewing)) || next
  if (!current) {
    return (
      <div className="ws-guide">
        <span style={{ flex: 1 }}>
          <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
            Guided mode · All {total} exercises done
          </span>
          <br />
          Every exercise on this case is done. Compare it with the base case, or export the report.
        </span>
        <Flag kind="beta" />
      </div>
    )
  }
  const n = LESSONS.findIndex((l) => l.id === current.id) + 1
  return (
    <div className="ws-guide ws-exercise" role="region" aria-label={`Exercise ${n} of ${total}`}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
          Guided mode · Exercise {n} of {total} · {TITLE[current.id]}
        </span>
        <span className="ds-sr-only"> ({doneCount} done)</span>
        <p style={{ margin: '6px 0 4px' }}>{current.task}</p>
        <p style={{ margin: 0, color: current.done(ctx.facts) ? 'var(--ds-green)' : 'var(--ds-text-2)' }}>
          {current.done(ctx.facts) ? '✓ ' : '○ '}
          {current.checkLabel}
        </p>
        {current.id === 'impact' && <Prediction />}
        {current.question && current.done(ctx.facts) && <Question key={current.id} id={current.id} />}
        {ctx.reviewing === current.id && ctx.state.lessons[current.id]?.correct && (
          <span style={{ display: 'block', marginTop: 10 }}>
            <Button size="small" variant="dark" onClick={() => ctx.setReviewing(null)}>
              {next ? 'Next exercise' : 'Done'}
            </Button>
          </span>
        )}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <Flag kind="beta" />
        <button type="button" className="ds-link" onClick={() => setGuided(false)}>
          Turn off
        </button>
      </span>
    </div>
  )
}

/** Exercise 4: name the step before the first run; after it, the honest reveal. */
function Prediction() {
  const ctx = useContext(Ctx)!
  const [pick, setPick] = useState('')
  const made = ctx.state.prediction
  if (!made && !ctx.facts.hasRun) {
    return (
      <span style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
        <label className="ds-label" style={{ marginBottom: 0 }}>
          Before you run: which step will carry the most climate impact?
          <select className="ds-input" style={{ display: 'block', marginTop: 4, minWidth: 220 }} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Pick a step</option>
            {ctx.operations.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <Button size="small" variant="dark" disabled={!pick} onClick={() => ctx.save({ ...ctx.state, prediction: { step: pick, madeAt: new Date().toISOString() } })}>
          Save my prediction
        </Button>
      </span>
    )
  }
  if (made && !ctx.facts.hasRun) return <p style={{ margin: '6px 0 0' }}>You predicted {made.step}. Now run the case.</p>
  if (made && ctx.topStep) {
    const right = made.step === ctx.topStep.name
    return (
      <p style={{ margin: '6px 0 0' }}>
        You predicted {made.step}. The run puts {ctx.topStep.name} first, at {ctx.topStep.share}.{' '}
        {right ? 'Right.' : 'Look at what builds it in Results.'}
      </p>
    )
  }
  return null
}

function Question({ id }: { id: LessonId }) {
  const ctx = useContext(Ctx)!
  const lesson = LESSONS.find((l) => l.id === id)!
  const q = lesson.question!
  const given = ctx.state.lessons[id]
  const [answer, setAnswer] = useState(given?.answer ?? '')
  const answered = given?.answer !== undefined
  const check = () => {
    const correct = q.kind === 'choice' ? answer === q.correct : numberIsRight(Number(answer), q)
    ctx.setReviewing(id)
    ctx.save({ ...ctx.state, lessons: { ...ctx.state.lessons, [id]: { answer, correct, doneAt: new Date().toISOString() } } })
  }
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      <strong style={{ fontSize: 13 }}>{q.prompt}</strong>
      {q.kind === 'choice' ? (
        <div role="radiogroup" aria-label={q.prompt} style={{ display: 'grid', gap: 4 }}>
          {q.options.map((o) => (
            <label key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minHeight: 24 }}>
              <input type="radio" name={`q-${id}`} className="ws-check" style={{ width: 18, height: 18 }} checked={answer === o.id} onChange={() => setAnswer(o.id)} />
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      ) : (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input className="ds-input" inputMode="decimal" style={{ width: 120 }} value={answer} aria-label={q.prompt} onChange={(e) => setAnswer(e.target.value)} />
          <span className="ds-mono">{q.unit}</span>
        </label>
      )}
      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Button size="small" variant="dark" disabled={!answer} onClick={check}>
          Check
        </Button>
        {answered && (
          <span role="status" style={{ fontWeight: 600, color: given?.correct ? 'var(--ds-green)' : 'var(--ds-error)' }}>
            {given?.correct ? 'Right.' : 'Not quite. Try again.'}
          </span>
        )}
      </span>
      {answered && <p style={{ margin: 0, fontSize: 13 }}>{q.because}</p>}
    </div>
  )
}

/** Facts for the checks, from what the workspace already holds. */
export function exerciseFacts(o: {
  referenceFlow: number | null
  functionalUnit: string | null
  layers: string[]
  hasRun: boolean
  otherCaseRan: boolean
  interpretation: string | null
}): LessonFacts {
  return {
    functionalUnitSet: !!(o.functionalUnit && o.functionalUnit.trim()) && (o.referenceFlow ?? 0) > 0,
    layers: o.layers,
    hasRun: o.hasRun,
    hasComparableCase: o.otherCaseRan,
    hasWriteUp: !!(o.interpretation && o.interpretation.trim()),
  }
}

