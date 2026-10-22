'use client'

// The project switcher (E19, sidebar.md "Switcher"): a combobox over the
// caller's projects in three groups. Typing filters, the arrow keys move, Enter
// opens, Esc closes and returns focus to the card that opened it.

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { SearchField } from '@/components/lcapix/ds'
import {
  caseCount,
  projectTint,
  relationOf,
  switcherGroups,
  switcherOrder,
  type NavProject,
  type SwitcherGroups,
} from '@/lib/shell/project-nav'
import { projectHref } from '@/lib/shell/routes'
import { ShellIcon } from './shell-icons'

const GROUPS: Array<{ key: keyof SwitcherGroups; label: string }> = [
  { key: 'pinned', label: 'Pinned' },
  { key: 'yours', label: 'Your projects' },
  { key: 'shared', label: 'Shared with you' },
]

export function ProjectSwitcher({
  projects,
  userId,
  openId,
  anchorRef,
  onClose,
}: {
  projects: NavProject[]
  userId: number | null
  openId: number | null
  anchorRef: RefObject<HTMLElement | null>
  onClose: (returnFocus: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const optionId = (i: number) => `${listId}-opt-${i}`

  const groups = useMemo(() => switcherGroups(projects, userId, query), [projects, userId, query])
  const order = useMemo(() => switcherOrder(groups), [groups])

  // Start on the open project when there is one.
  useEffect(() => {
    const i = order.findIndex((p) => p.project_id === openId)
    setActive(i >= 0 && !query ? i : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Beside the card on a wide screen, below it on a narrow one.
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 16, top: 16 })
  useEffect(() => {
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect()
      if (!r) return
      const wide = window.innerWidth >= 900
      const top = wide ? Math.max(12, Math.min(r.top, window.innerHeight - 520)) : r.bottom + 6
      setPos({ left: wide ? r.right + 14 : Math.max(8, r.left), top })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchorRef])

  // A click outside closes without moving focus back (the click went elsewhere).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return
      onClose(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [anchorRef, onClose])

  const open = (p: NavProject) => {
    onClose(false)
    router.push(projectHref(p.project_id))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (order.length ? (i + 1) % order.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (order.length ? (i - 1 + order.length) % order.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (order[active]) open(order[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose(true)
    } else if (e.key === 'Tab') {
      onClose(false)
    }
  }

  // Keep the active row in view.
  useEffect(() => {
    const el = document.getElementById(optionId(active))
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  let index = -1
  return (
    <div
      ref={panelRef}
      className="ds-popover"
      style={{ position: 'fixed', left: pos.left, top: pos.top }}
      role="dialog"
      aria-label="Switch project"
    >
      <div style={{ padding: 12 }}>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Find a project"
          autoFocus
          onKeyDown={onKeyDown}
          hint={projects.length}
          inputProps={{
            role: 'combobox',
            'aria-expanded': true,
            'aria-controls': listId,
            'aria-autocomplete': 'list',
            'aria-activedescendant': order[active] ? optionId(active) : undefined,
          }}
        />
      </div>
      <div className="ds-popover-body" id={listId} role="listbox" aria-label="Projects">
        {order.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--ds-text-3)', padding: '8px 10px', margin: 0 }}>No project matches.</p>
        )}
        {GROUPS.map(({ key, label }) => {
          const rows = groups[key]
          if (!rows.length) return null
          const labelId = `${listId}-${key}`
          return (
            <div key={key} role="group" aria-labelledby={labelId}>
              <div id={labelId} className="ds-section-label ds-group-label">
                {label}
              </div>
              {rows.map((p) => {
                index += 1
                const i = index
                const current = p.project_id === openId
                const shared = relationOf(p, userId) === 'member'
                return (
                  <div
                    key={p.project_id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    data-current={current || undefined}
                    className="ds-option"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => open(p)}
                  >
                    <span className="ds-tint-dot" style={{ background: projectTint(p, projects) }} aria-hidden />
                    <span className="ds-option-name" title={p.project_name}>
                      {p.project_name}
                    </span>
                    <span className="ds-option-meta" style={shared ? { fontFamily: 'inherit' } : undefined}>
                      {shared && p.owner_name ? p.owner_name : caseCount(p.case_count)}
                    </span>
                    {current && (
                      <span style={{ color: 'var(--ds-green)' }}>
                        <ShellIcon name="check" size={16} />
                        <span className="ds-sr-only">(open)</span>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="ds-popover-foot">
        <a className="ds-link" href="/project/new">
          <ShellIcon name="plus" size={16} /> New project
        </a>
        <a className="ds-link" href="/home" style={{ color: 'var(--ds-text)', fontWeight: 500 }}>
          All projects <ShellIcon name="chevron" size={16} />
        </a>
      </div>
    </div>
  )
}
