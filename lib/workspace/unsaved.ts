'use client'

/**
 * Unsaved edits in the case editor (B3): every editor with a change that is
 * not saved yet registers here. Leaving with one open (another step, another
 * tab, a link, browser back, closing the page) asks first: the bar says
 * "You have unsaved changes" with Save and Discard, and the move happens
 * only after one of them. Nothing is lost silently and nothing saves on its own.
 *
 * - Clicking another step: the tree asks through guard().
 * - Case tabs and links: a capture-phase click listener holds the click and
 *   replays it after Save or Discard (the tabs belong to the case page).
 * - Browser back: a same-URL history entry sits on top while anything is
 *   unsaved; Back lands on the entry below it (the same page) and asks.
 * - Closing or reloading the page: beforeunload.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'

export interface UnsavedEdit {
  /** What the bar names: "Steel on 10. Cut blank". */
  label: string
  /** Saves the edit; resolves true when it saved. */
  save: () => Promise<boolean>
  /** Puts the editor back to what is stored. */
  discard: () => void
}

type Pending = { run: () => void } | null

const edits = new Map<string, UnsavedEdit>()
let pending: Pending = null
let saving = false
/** A held move is about to run: the same-URL entry stays (popping it would undo the move). */
let leaving = false
let version = 0
const listeners = new Set<() => void>()
const SENTINEL = '__lcapixUnsaved'

function emit() {
  version++
  for (const l of listeners) l()
  syncWindowGuards()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function hasUnsaved(): boolean {
  return edits.size > 0
}

export function unsavedLabels(): string[] {
  return [...edits.values()].map((e) => e.label)
}

export function pendingLeave(): boolean {
  return pending !== null
}

/**
 * Run `go` now when nothing is unsaved; else hold it and ask. Returns true
 * when it ran straight away.
 */
export function guard(go: () => void): boolean {
  if (!edits.size) {
    go()
    return true
  }
  pending = { run: go }
  emit()
  return false
}

/** Save every open edit, then make the held move. Stays when one fails. */
export async function saveAndGo(): Promise<boolean> {
  if (saving) return false
  saving = true
  emit()
  let ok = true
  for (const [id, e] of [...edits]) {
    const done = await e.save().catch(() => false)
    if (done) edits.delete(id)
    else ok = false
  }
  saving = false
  const next = ok ? pending : null
  if (ok) pending = null
  if (next) leaving = true
  emit()
  leaving = false
  next?.run()
  return ok
}

/** Throw every open edit away, then make the held move. */
export function discardAndGo(): void {
  for (const e of edits.values()) e.discard()
  edits.clear()
  const next = pending
  pending = null
  if (next) leaving = true
  emit()
  leaving = false
  next?.run()
}

/** Stay where you are and keep the edits. */
export function keepEditing(): void {
  pending = null
  emit()
  ensureSentinel()
}

export function isSaving(): boolean {
  return saving
}

/** For tests: forget everything. */
export function resetUnsaved(): void {
  edits.clear()
  pending = null
  saving = false
  emit()
}

/** Hold an unsaved edit under `id` (the hook below does this for an editor). */
export function registerUnsaved(id: string, edit: UnsavedEdit): void {
  edits.set(id, edit)
  emit()
}

/** The edit under `id` is saved or gone. */
export function clearUnsaved(id: string): void {
  if (edits.delete(id)) emit()
}

/**
 * Register an editor's unsaved edit while `dirty` is true. The latest
 * save and discard are always the ones called.
 */
export function useUnsavedEdit(id: string, dirty: boolean, edit: UnsavedEdit): void {
  const latest = useRef(edit)
  latest.current = edit
  useEffect(() => {
    if (!dirty) {
      clearUnsaved(id)
      return
    }
    registerUnsaved(id, {
      get label() {
        return latest.current.label
      },
      save: () => latest.current.save(),
      discard: () => latest.current.discard(),
    })
    return () => clearUnsaved(id)
  }, [id, dirty])
}

/** The unsaved state, for the bar. */
export function useUnsavedState(): { labels: string[]; pending: boolean; saving: boolean } {
  useSyncExternalStore(subscribe, () => version, () => 0)
  return { labels: unsavedLabels(), pending: pending !== null, saving }
}

// ── The window: beforeunload, browser back, tabs and links ──────────────────

let windowBound = false
let replaying = false

function ensureSentinel() {
  if (typeof window === 'undefined' || !edits.size) return
  const st = window.history.state
  if (st && st[SENTINEL]) return
  try {
    window.history.pushState({ ...(st ?? {}), [SENTINEL]: true }, '', window.location.href)
  } catch {}
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!edits.size) return
  e.preventDefault()
  e.returnValue = ''
}

function onPopState() {
  if (!edits.size || replaying) return
  // Back stepped off the same-URL entry: this page is still showing. Ask,
  // and on Save or Discard go back for real.
  const st = window.history.state
  if (st && st[SENTINEL]) return
  pending = { run: () => window.history.back() }
  emit()
}

/** Clicks on case tabs and on links leave the editor: hold them while anything is unsaved. */
function onClickCapture(e: MouseEvent) {
  if (!edits.size || replaying) return
  const target = e.target as HTMLElement | null
  if (!target || typeof target.closest !== 'function') return
  // The bar's own buttons, and anything inside an editor, are not a leave.
  if (target.closest('[data-unsaved-bar]')) return
  const tab = target.closest<HTMLElement>('[role="tab"]')
  const link = target.closest<HTMLAnchorElement>('a[href]')
  const leaving = tab ? tab.getAttribute('aria-selected') !== 'true' : link ? !link.closest('[data-unsaved-safe]') && link.target !== '_blank' : false
  if (!leaving) return
  const el = (tab ?? link)!
  e.preventDefault()
  e.stopPropagation()
  pending = {
    run: () => {
      replaying = true
      try {
        el.click()
      } finally {
        setTimeout(() => (replaying = false), 0)
      }
    },
  }
  emit()
}

function syncWindowGuards() {
  if (typeof window === 'undefined') return
  if (edits.size && !windowBound) {
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('popstate', onPopState)
    document.addEventListener('click', onClickCapture, true)
    windowBound = true
  }
  if (edits.size) ensureSentinel()
  // Everything saved where it stands: take the same-URL entry off again, so
  // one Back still leaves the page.
  if (!edits.size && !pending && !leaving && window.history.state?.[SENTINEL]) {
    replaying = true
    window.history.back()
    setTimeout(() => (replaying = false), 300)
  }
  if (!edits.size && windowBound && !pending) {
    window.removeEventListener('beforeunload', onBeforeUnload)
    window.removeEventListener('popstate', onPopState)
    document.removeEventListener('click', onClickCapture, true)
    windowBound = false
  }
}
