'use client'

// The foot of Check what we read (F2): "Next:" in one sentence (what Save
// does and the file that comes after it), with Save and Start over. They are
// here only, once: the review is read top to bottom and ends on what to do.
// A blocked Save says why under the button.

import { Button } from '@/components/lcapix/ds'

/** What comes after this file, for the sentence after "Next:". */
export function afterThisFile(connector: string): string {
  if (connector === 'routing') return 'Then add the bill of materials for the materials, and the equipment list for machine energy.'
  if (connector === 'bom') return 'Then add the equipment list for machine energy, or run the case.'
  if (connector === 'equipment') return 'Then run the case to see which step builds the number.'
  return 'Then open the case and run it.'
}

export function NextBar({
  connector,
  appending,
  saveLabel,
  blockedReason,
  applying,
  onApply,
  onStartOver,
}: {
  connector: string
  appending: boolean
  saveLabel: string
  blockedReason: string | null
  applying: boolean
  onApply: () => void
  onStartOver: () => void
}) {
  return (
    <section className="ip-next" aria-labelledby="ip-next-h">
      <p style={{ margin: 0, flex: 1, minWidth: 260 }}>
        <strong id="ip-next-h">Next:</strong> {appending ? 'Save adds these lines to the case.' : 'Save makes the case from these steps.'} {afterThisFile(connector)}
      </p>
      <span style={{ display: 'inline-flex', gap: 10 }}>
        <Button onClick={onStartOver}>Start over</Button>
        <Button variant="primary" onClick={onApply} busy={applying} disabled={!!blockedReason} disabledReason={blockedReason ?? undefined}>
          <span aria-hidden>✓</span> {saveLabel}
        </Button>
      </span>
    </section>
  )
}
