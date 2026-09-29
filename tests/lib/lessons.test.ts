import { describe, expect, it } from 'vitest'

import {
  EMPTY_STATE,
  LESSONS,
  lessonComplete,
  numberIsRight,
  parseLearningState,
  progress,
  type LearningState,
  type LessonFacts,
} from '@/lib/lessons'

const facts = (over: Partial<LessonFacts> = {}): LessonFacts => ({
  functionalUnitSet: false,
  layers: [],
  hasRun: false,
  hasComparableCase: false,
  hasWriteUp: false,
  ...over,
})

const lesson = (id: string) => LESSONS.find((l) => l.id === id)!

describe('lessons', () => {
  it('needs the work done AND the question right, so clicking through cannot pass it', () => {
    const f = facts({ functionalUnitSet: true })
    const scope = lesson('scope')

    // Work done, question unanswered.
    expect(lessonComplete(scope, f, EMPTY_STATE)).toBe(false)

    // Question right, but nothing set on the case.
    const answered: LearningState = { version: 1, lessons: { scope: { correct: true } } }
    expect(lessonComplete(scope, facts(), answered)).toBe(false)

    expect(lessonComplete(scope, f, answered)).toBe(true)
  })

  it('reads the student\'s own case for each check', () => {
    expect(lesson('inventory').done(facts({ layers: ['skeleton'] }))).toBe(false)
    expect(lesson('inventory').done(facts({ layers: ['skeleton', 'materials'] }))).toBe(true)
    expect(lesson('energy').done(facts({ layers: ['materials'] }))).toBe(false)
    expect(lesson('energy').done(facts({ layers: ['energy'] }))).toBe(true)
    expect(lesson('impact').done(facts({ hasRun: true }))).toBe(true)
    expect(lesson('compare').done(facts({ hasComparableCase: true }))).toBe(true)
    expect(lesson('handin').done(facts({ hasWriteUp: true }))).toBe(true)
  })

  it('points at the first unfinished lesson', () => {
    const all: LearningState = {
      version: 1,
      lessons: { scope: { correct: true }, inventory: { correct: true } },
    }
    const p = progress(facts({ functionalUnitSet: true, layers: ['materials'] }), all)
    expect(p.doneCount).toBe(2)
    expect(p.current?.id).toBe('energy')
  })

  it('judges the energy answer by closeness, not by exact digits', () => {
    const q = lesson('energy').question as Extract<
      NonNullable<(typeof LESSONS)[number]['question']>,
      { kind: 'number' }
    >
    expect(q.answer).toBeCloseTo(5.6 * 0.8 * 0.08, 6) // rated power x hours x load
    expect(numberIsRight(0.3584, q)).toBe(true)
    expect(numberIsRight(0.36, q)).toBe(true)
    expect(numberIsRight(4.48, q)).toBe(false) // forgot the load factor
    expect(numberIsRight(Number.NaN, q)).toBe(false)
  })

  it('survives a learning_state that is a string, null, or nonsense', () => {
    expect(parseLearningState(null)).toEqual(EMPTY_STATE)
    expect(parseLearningState('not json')).toEqual(EMPTY_STATE)
    expect(parseLearningState('{"lessons":{"scope":{"correct":true}}}').lessons.scope?.correct).toBe(
      true,
    )
    expect(parseLearningState({ lessons: { impact: { answer: 'b', correct: false } } }).lessons.impact
      ?.answer).toBe('b')
  })

  it('keeps every multiple-choice answer key inside its own options', () => {
    for (const l of LESSONS) {
      if (l.question?.kind !== 'choice') continue
      expect(l.question.options.map((o) => o.id)).toContain(l.question.correct)
    }
  })
})
