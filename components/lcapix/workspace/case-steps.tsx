'use client'

// The step bar across a case (lib/workspace/case-steps.ts): goal and scope,
// inventory, impact assessment, interpretation, and Hand in on an assignment
// case, each ticked from the case's own data, then the one Next button. Each
// step is also a button to where that step is done.

import { Button } from '@/components/lcapix/ds'
import { nextCaseStep, type CaseStep, type CaseStepKey } from '@/lib/workspace/case-steps'

export function CaseSteps({ steps, onAct }: { steps: CaseStep[]; onAct: (key: CaseStepKey) => void }) {
  const next = nextCaseStep(steps)
  return (
    <nav className="ws-steps" aria-label="Where this case stands">
      <ol>
        {steps.map((s, i) => {
          const mark = s.done ? '✓' : String(i + 1)
          const state = s.done ? 'done' : next?.key === s.key ? 'next' : 'todo'
          const inner = (
            <>
              <span className="ws-steps-mark" aria-hidden>
                {mark}
              </span>
              <span className="ws-steps-text">
                <span className="ws-steps-label">{s.label}</span>
                <span className="ws-steps-detail">{s.detail}</span>
              </span>
            </>
          )
          return (
            <li key={s.key} className={`ws-steps-item ws-steps-item--${state}`}>
              {s.action ? (
                <button type="button" onClick={() => onAct(s.key)} aria-label={`${s.label}: ${s.done ? 'done' : 'not done'}. ${s.detail}. ${s.action}`}>
                  {inner}
                </button>
              ) : (
                <span className="ws-steps-static" aria-label={`${s.label}: ${s.done ? 'done' : 'not done'}. ${s.detail}`}>
                  {inner}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {next ? (
        <Button size="small" variant="primary" onClick={() => onAct(next.key)}>
          Next: {next.action}
        </Button>
      ) : (
        <span className="ws-steps-alldone" role="status">
          Every step is done
        </span>
      )}
    </nav>
  )
}
