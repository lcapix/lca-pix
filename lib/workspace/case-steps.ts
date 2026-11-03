/**
 * The step bar across a case: the four phases of ISO 14044, the words a
 * student learns in class (goal and scope, inventory, impact assessment,
 * interpretation), plus Hand in on an assignment case. Each step is done or
 * not from the case's own data, with one line on where it stands and the
 * action that moves it on. The first step not done is the case's "Next". Pure.
 */

export type CaseStepKey = 'scope' | 'inventory' | 'impact' | 'interpretation' | 'handin'

export interface CaseStepsInput {
  functionalUnit: string | null
  referenceFlow: number | null
  /** Whether this person can change the study's goal and scope (Project settings). */
  canSetScope: boolean
  stepCount: number
  flowCount: number
  /** Flows a run counts (counted, or with no factor yet). */
  countedFlows: number
  needsAmount: number
  leftOut: number
  /** The latest run's label on this case ("Run 2"), or null before a first run. */
  runLabel: string | null
  changedAfterRun: boolean
  hasWriteUp: boolean
  /** An assignment case shows Hand in; handedIn once a copy was handed in. */
  assignment: boolean
  handedIn: boolean
}

export interface CaseStep {
  key: CaseStepKey
  label: string
  done: boolean
  /** One line: where this step stands. */
  detail: string
  /** The action that moves it on, as a button label ("Run the case"); null when there is none for this person. */
  action: string | null
}

const flows = (n: number) => `${n} ${n === 1 ? 'flow' : 'flows'}`

export function caseSteps(i: CaseStepsInput): CaseStep[] {
  const unit = i.functionalUnit?.trim() ?? ''
  const scopeDone = !!unit && (i.referenceFlow ?? 0) > 0
  const missing = i.needsAmount + i.leftOut
  const inventoryDone = i.countedFlows > 0 && missing === 0
  const ran = i.runLabel !== null
  const out: CaseStep[] = [
    {
      key: 'scope',
      label: 'Goal and scope',
      done: scopeDone,
      detail: scopeDone ? `Per ${unit}` : i.canSetScope ? 'No functional unit yet' : 'Your instructor sets the functional unit',
      action: !i.canSetScope ? null : scopeDone ? 'See the goal and scope' : 'Set the functional unit',
    },
    {
      key: 'inventory',
      label: 'Inventory',
      done: inventoryDone,
      detail: !i.stepCount
        ? 'No steps yet'
        : !i.flowCount
          ? 'No flows yet'
          : missing
            ? `${flows(missing)} left out of a run`
            : `${flows(i.flowCount)} on ${i.stepCount} ${i.stepCount === 1 ? 'step' : 'steps'}`,
      action: !i.stepCount ? 'Add the first step' : !i.flowCount ? 'Add a flow' : missing ? 'Give every flow an amount' : 'See the inventory',
    },
    {
      key: 'impact',
      label: 'Impact assessment',
      done: ran && !i.changedAfterRun,
      detail: !ran ? 'Not run yet' : i.changedAfterRun ? `Changed since ${i.runLabel}` : `${i.runLabel}`,
      action: !ran ? 'Run the case' : i.changedAfterRun ? 'Run it again' : 'See the results',
    },
    {
      key: 'interpretation',
      label: 'Interpretation',
      done: i.hasWriteUp,
      detail: i.hasWriteUp ? 'Written' : 'Say what the result means',
      action: i.hasWriteUp ? 'See the write-up' : 'Write the interpretation',
    },
  ]
  if (i.assignment) {
    out.push({
      key: 'handin',
      label: 'Hand in',
      done: i.handedIn,
      detail: i.handedIn ? 'Handed in' : 'Your instructor gets a read-only copy',
      action: i.handedIn ? 'See it on Assignments' : 'Hand it in',
    })
  }
  return out
}

/**
 * The step to do next: the first one not done that this person can act on.
 * A goal and scope only the instructor can set is skipped, so a student can
 * still build the inventory. Null when nothing is left to do.
 */
export function nextCaseStep(steps: CaseStep[]): CaseStep | null {
  return steps.find((s) => !s.done && s.action) ?? null
}
