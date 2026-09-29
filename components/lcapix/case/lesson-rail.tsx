'use client'

/**
 * The guided lessons, docked under the editor toolbar.
 *
 * Five lessons that follow the ISO phases, done in the real app rather than a
 * simulator: a one-line goal, the task, a check that reads the student's own
 * case, and one question. Progress is saved on the case, so an instructor can
 * see how far each student got next to the model they built.
 *
 * Deliberately plain: a thin progress bar, a check mark, no streaks and no
 * confetti. It sits beside professional work and has to look like it belongs.
 */

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import {
  EMPTY_STATE,
  LESSONS,
  lessonComplete,
  numberIsRight,
  parseLearningState,
  progress,
  type LearningState,
  type LessonFacts,
  type LessonId,
} from '@/lib/lessons'

type Props = {
  caseId: string | number
  facts: LessonFacts
  initialState?: unknown
  /** Process steps the student can name in the prediction before the first run. */
  steps?: string[]
  /** The step that actually carried the most of the headline category, once run. */
  topStep?: string | null
  onClose: () => void
}

export function LessonRail({ caseId, facts, initialState, steps = [], topStep, onClose }: Props) {
  const [state, setState] = useState<LearningState>(() => parseLearningState(initialState))
  const [openId, setOpenId] = useState<LessonId | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setState(parseLearningState(initialState))
  }, [initialState])

  const { doneCount, total, current } = useMemo(() => progress(facts, state), [facts, state])

  // Open the lesson being worked on, unless the student picked another one.
  useEffect(() => {
    setOpenId((cur) => cur ?? current?.id ?? null)
  }, [current])

  const active = LESSONS.find((l) => l.id === openId) ?? current ?? LESSONS[0]
  const answered = active ? state.lessons[active.id] : undefined

  const persist = async (next: LearningState) => {
    setState(next)
    setSaving(true)
    try {
      const res = await apiRequest(`/api/cases/${caseId}`, {
        method: 'PUT',
        body: JSON.stringify({ learning_state: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || 'Progress could not be saved')
      }
    } catch {
      toast.error('Progress could not be saved')
    } finally {
      setSaving(false)
    }
  }

  const answer = (value: string) => {
    if (!active?.question) return
    const q = active.question
    const correct =
      q.kind === 'choice' ? value === q.correct : numberIsRight(parseFloat(value), q)
    const next: LearningState = {
      ...state,
      lessons: {
        ...state.lessons,
        [active.id]: {
          answer: value,
          correct,
          doneAt: correct ? new Date().toISOString() : state.lessons[active.id]?.doneAt,
        },
      },
    }
    persist(next)
  }

  const predict = (step: string) => {
    persist({ ...state, prediction: { step, madeAt: new Date().toISOString() } })
  }

  const barStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--surface-raised)',
    padding: '10px 16px',
  }

  return (
    <div style={barStyle} aria-label="Guided lessons">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text-primary)' }}>Learn</span>

        {/* One dot per lesson: filled when it is complete, ringed while active. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {LESSONS.map((l, i) => {
            const complete = lessonComplete(l, facts, state)
            const isActive = active?.id === l.id
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setOpenId(l.id)}
                title={`${i + 1}. ${l.title}${complete ? ' (done)' : ''}`}
                aria-current={isActive ? 'step' : undefined}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: isActive
                    ? '2px solid var(--brand-primary, #1d7848)'
                    : '1px solid var(--border-subtle)',
                  background: complete ? 'var(--brand-primary, #1d7848)' : 'var(--surface-base)',
                  color: complete ? '#fff' : 'var(--text-tertiary)',
                  fontSize: 10,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                {complete ? '✓' : i + 1}
              </button>
            )
          })}
        </div>

        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {doneCount} of {total} done{saving ? ' · saving…' : ''}
        </span>

        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} title="Hide the lessons">
          Hide
        </button>
      </div>

      {active && (
        <div style={{ marginTop: 10, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px', minWidth: 300 }}>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text-primary)' }}>
              {LESSONS.findIndex((l) => l.id === active.id) + 1}. {active.title}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
              {active.goal}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginTop: 8 }}>
              <strong style={{ fontWeight: 600 }}>Do this:</strong> {active.task}
            </div>
            <div
              style={{
                fontSize: 12,
                marginTop: 8,
                color: active.done(facts) ? 'var(--brand-primary, #1d7848)' : 'var(--text-tertiary)',
              }}
              title="Checked against your own case, not against a click"
            >
              {active.done(facts) ? '✓ ' : '○ '}
              {active.checkLabel}
            </div>

            {/* Predict before the reveal: only on the impact lesson, only before a run. */}
            {active.id === 'impact' && steps.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {!state.prediction && !facts.hasRun && (
                  <>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                      Before you run it: which step will carry the most climate impact?
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {steps.slice(0, 8).map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => predict(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {state.prediction && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    You predicted <strong>{state.prediction.step}</strong>.{' '}
                    {topStep
                      ? topStep === state.prediction.step
                        ? 'The run agrees.'
                        : `The run says ${topStep} carries the most. Open the flows of both steps and see what differs.`
                      : 'Run the assessment to see whether the model agrees.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {active.question && (
            <div style={{ flex: '1 1 320px', minWidth: 280 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                {active.question.prompt}
              </div>

              {active.question.kind === 'choice' && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {active.question.options.map((o) => {
                    const picked = answered?.answer === o.id
                    const right = answered?.correct && picked
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => answer(o.id)}
                        style={{
                          textAlign: 'left',
                          padding: '7px 10px',
                          borderRadius: 8,
                          border: `1px solid ${
                            picked
                              ? right
                                ? 'var(--brand-primary, #1d7848)'
                                : 'var(--danger, #b42318)'
                              : 'var(--border-subtle)'
                          }`,
                          background: 'var(--surface-base)',
                          color: 'var(--text-primary)',
                          fontSize: 12.5,
                          cursor: 'pointer',
                        }}
                      >
                        {o.text}
                      </button>
                    )
                  })}
                </div>
              )}

              {active.question.kind === 'number' && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    style={{
                      width: 120,
                      fontSize: 12.5,
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-base)',
                      color: 'var(--text-primary)',
                    }}
                    aria-label={active.question.prompt}
                  />
                  <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                    {active.question.unit}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => answer(draft)}
                    disabled={!draft.trim()}
                  >
                    Check
                  </button>
                </div>
              )}

              {answered?.answer !== undefined && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: answered.correct ? 'var(--text-secondary)' : 'var(--text-primary)',
                  }}
                >
                  <strong style={{ fontWeight: 600 }}>
                    {answered.correct ? 'Right. ' : 'Not that one. '}
                  </strong>
                  {active.question.because}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LessonRail
