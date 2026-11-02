import type { KeyboardEvent } from 'react'

/**
 * Enter never submits a form (B2, "Enter never saves"): pressing Enter in a
 * field of a form made the project, the case or the profile with whatever was
 * typed so far. Put on the form's onKeyDown; only its button submits. A
 * textarea keeps Enter for a new line, and Enter on a focused button still
 * presses that button.
 */
export function blockEnterSubmit(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return
  const t = e.target as HTMLElement
  if (t instanceof HTMLInputElement && !['submit', 'button', 'image', 'reset'].includes(t.type)) e.preventDefault()
  if (t instanceof HTMLSelectElement) e.preventDefault()
}
