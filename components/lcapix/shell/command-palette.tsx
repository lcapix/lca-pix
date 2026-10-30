'use client'

// The command palette (⌘K or Ctrl+K, or the sample Overview's search field):
// places, recent projects from the shell's own store (G137), and the account
// commands (G139). No theme commands: the design has one light theme (G138).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth/sign-out'
import { recentProjects, showsNewProject } from '@/lib/shell/project-nav'
import { projectHref } from '@/lib/shell/routes'
import { useRecentProjects, useShellStore } from '@/lib/shell/use-shell'
import { ShellIcon } from './shell-icons'

export const OPEN_SEARCH_EVENT = 'lcapix:open-search'

interface Command {
  id: string
  group: string
  label: string
  icon: string
  /** Projects are matched on the query already. */
  project?: boolean
  go: () => void
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { projects, profile } = useShellStore()
  const recentIds = useRecentProjects(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
    }
  }, [])

  // Opening starts fresh, with focus in the field; closing gives focus back.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    setQuery('')
    setActive(0)
    inputRef.current?.focus()
    return () => opener?.focus?.()
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const to = (href: string) => () => router.push(href)
    const userId = profile?.id ?? null
    const list: Command[] = [
      { id: 'home', group: 'Go to', label: 'Home', icon: 'home', go: to('/home') },
      { id: 'projects', group: 'Go to', label: 'Projects', icon: 'grid', go: to('/home') },
      { id: 'findings', group: 'Go to', label: 'Findings', icon: 'pin', go: to('/findings') },
      { id: 'reports', group: 'Go to', label: 'Reports', icon: 'report', go: to('/reports') },
      { id: 'guide', group: 'Go to', label: 'Guide', icon: 'help', go: to('/guide') },
      { id: 'about', group: 'Go to', label: 'About', icon: 'help', go: to('/about') },
      { id: 'admin', group: 'Go to', label: 'Admin', icon: 'analytics', go: to('/admin/integrations') },
    ]
    if (showsNewProject(projects, userId)) {
      list.push({ id: 'new', group: 'Go to', label: 'New project', icon: 'plus', go: to('/project/new') })
    }
    // Typing searches every project; an empty field shows the five most recent.
    const q = query.trim().toLowerCase()
    const shown = q
      ? projects.filter((p) => p.project_name.toLowerCase().includes(q))
      : recentProjects(projects, recentIds, null, 5)
    for (const p of shown) {
      list.push({
        id: `p${p.project_id}`,
        group: q ? 'Projects' : 'Recent projects',
        label: p.project_name,
        icon: 'chevron',
        project: true,
        go: to(projectHref(p.project_id)),
      })
    }
    list.push(
      { id: 'profile', group: 'Account', label: 'Profile', icon: 'report', go: to('/profile') },
      { id: 'logout', group: 'Account', label: 'Log out', icon: 'out', go: () => signOut((path) => router.push(path)) },
    )
    return list
  }, [router, projects, profile, recentIds, query])

  const q = query.trim().toLowerCase()
  const matches = q ? commands.filter((c) => c.project || c.label.toLowerCase().includes(q)) : commands
  const pick = Math.min(active, Math.max(matches.length - 1, 0))

  if (!open) return null

  const run = (c: Command) => {
    setOpen(false)
    c.go()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((pick + 1) % Math.max(matches.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((pick - 1 + matches.length) % Math.max(matches.length, 1))
    } else if (e.key === 'Enter' && matches[pick]) {
      e.preventDefault()
      run(matches[pick])
    } else if (e.key === 'Tab') {
      // One control inside: focus goes back to the field.
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  const groups = [...new Set(matches.map((c) => c.group))]

  return (
    <div className="ds-scrim" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="ds-dialog cp-dialog" role="dialog" aria-modal="true" aria-label="Command Palette" onKeyDown={onKeyDown}>
        <div className="ds-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className="ds-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="cp-list"
            aria-activedescendant={matches[pick] ? `cp-${matches[pick].id}` : undefined}
            aria-label="Search commands and projects"
            placeholder="Go to a page or a project"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
          />
        </div>
        {matches.length === 0 && <p className="cp-empty">Nothing matches “{query.trim()}”.</p>}
        <div id="cp-list" role="listbox" aria-label="Commands" className="cp-list">
          {groups.map((g) => (
            <div key={g} role="group" aria-label={g}>
              <div className="ds-section-label cp-group">{g}</div>
              {matches
                .filter((c) => c.group === g)
                .map((c) => {
                  const i = matches.indexOf(c)
                  return (
                    <div
                      key={c.id}
                      id={`cp-${c.id}`}
                      role="option"
                      aria-selected={i === pick}
                      className="ds-option"
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => run(c)}
                    >
                      <ShellIcon name={c.icon} size={16} />
                      <span className="cp-label">{c.label}</span>
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
        <p className="cp-foot ds-mono">
          ↑ ↓ to move · Enter to open · Esc to close
        </p>
      </div>
    </div>
  )
}
