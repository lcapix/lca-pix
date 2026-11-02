/**
 * Her rule (2026-11-01): Enter never saves. A form's onKeyDown that stops
 * Enter in a one-line box from submitting the form, so creating, publishing
 * or saving takes the form's own button. Enter still works in a text area
 * (a new line), on a button, a link, a select and a checkbox.
 */

type KeyEventLike = { key: string; target: EventTarget | null; preventDefault: () => void; nativeEvent?: { isComposing?: boolean } }

const ONE_LINE = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password', 'date', 'datetime-local', 'time', 'month', 'week', ''])

export function enterNeverSubmits(e: KeyEventLike): void {
  if (e.key !== 'Enter' || e.nativeEvent?.isComposing) return
  const t = e.target as { tagName?: string; type?: string } | null
  if (!t || String(t.tagName ?? '').toUpperCase() !== 'INPUT') return
  if (ONE_LINE.has(String(t.type ?? '').toLowerCase())) e.preventDefault()
}
