// @vitest-environment jsdom
/**
 * The exercise card (E04, E05, E06): with Guided mode on, the first exercise
 * not done, its live check and its question; a right answer stays on screen
 * with its reason until Next; exercise 4 asks for a prediction before the
 * first run. With Guided mode off there is no card.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExerciseProvider, ExerciseSlot, exerciseFacts } from '@/components/lcapix/workspace/exercise-card'

const put = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
vi.mock('@/lib/api-client', () => ({ apiRequest: (...a: any[]) => (put as any)(...a) }))

const facts = exerciseFacts({ referenceFlow: 1, functionalUnit: '1 painted steel bracket', layers: ['materials', 'energy'], hasRun: false, otherCaseRan: true, interpretation: null })
const ui = (initial: unknown = null) =>
  render(
    <ExerciseProvider caseId={221} initial={initial} facts={facts} operations={['10. Cut blank', '30. Powder coat and cure']} topStep={null}>
      <ExerciseSlot fallback={<p>scripted line</p>} />
    </ExerciseProvider>,
  )

describe('exercise card', () => {
  beforeEach(() => {
    localStorage.setItem('lcapix-guided-mode', '1')
    put.mockClear()
  })

  it('exercise 1: the check, the bracket question, Right with its reason, then Next', async () => {
    ui()
    expect(await screen.findByText(/Exercise 1 of 6 · Goal and scope/i)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('One painted steel bracket, at the factory gate'))
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText('Right.')).toBeTruthy()
    expect(screen.getByText(/a line is a place, not a unit of service/)).toBeTruthy()
    const body = JSON.parse((put.mock.calls[0] as any)[1].body)
    expect(body.learning_state.lessons.scope).toMatchObject({ answer: 'b', correct: true })
    fireEvent.click(screen.getByRole('button', { name: 'Next exercise' }))
    expect(await screen.findByText(/Exercise 2 of 6 · Materials/i)).toBeTruthy()
  })

  it('exercise 4 asks for a prediction before the first run', async () => {
    ui({ version: 1, lessons: { scope: { correct: true }, inventory: { correct: true }, energy: { correct: true } } })
    expect(await screen.findByText(/Exercise 4 of 6 · Prediction/i)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/which step will carry the most climate impact/i), { target: { value: '10. Cut blank' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save my prediction' }))
    await waitFor(() => expect(screen.getByText('You predicted 10. Cut blank. Now run the case.')).toBeTruthy())
  })

  it('Guided mode off: no card', () => {
    localStorage.setItem('lcapix-guided-mode', '0')
    const { container } = ui()
    expect(container.textContent).toBe('')
  })
})
