'use client'

// The sidebar on every signed-in page (sidebar.md): places, the open project's
// switcher card and its pages, Recent, All projects, + New project, Help, and
// the profile with Sign out.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { Flag, CountPill } from '@/components/lcapix/ds'
import { usePlatformAdmin } from '@/lib/auth/use-platform-admin'
import { signOut } from '@/lib/auth/sign-out'
import {
  peopleOn,
  placesFor,
  projectInitials,
  projectMeta,
  projectPagesFor,
  projectTint,
  recentProjects,
  showsNewProject,
} from '@/lib/shell/project-nav'
import { PAGE_LABEL, PLACE_ICON, PLACE_LABEL, placeHref, placeOf, projectHref, projectPageOf } from '@/lib/shell/routes'
import { useRecentProjects, useShellData } from '@/lib/shell/use-shell'
import { initialsOf } from '@/lib/home/projects'
import { PixelMark, ShellIcon } from './shell-icons'
import { ProjectSwitcher } from './project-switcher'

export function Sidebar({ open, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() ?? ''
  const params = useParams<{ projectId?: string }>()
  const router = useRouter()
  const { projects, profile, status } = useShellData()
  const isPlatformAdmin = usePlatformAdmin()

  const routeId = Number(params?.projectId)
  const openId = Number.isInteger(routeId) && routeId > 0 ? routeId : null
  const recentIds = useRecentProjects(openId)
  const userId = profile?.id ?? null

  // The card shows the open project, else the last one opened here, else the newest.
  const cardProject = useMemo(() => {
    if (openId) return projects.find((p) => p.project_id === openId) ?? null
    return recentProjects(projects, recentIds, null, 1)[0] ?? null
  }, [projects, openId, recentIds])
  const openProject = openId ? cardProject : null

  const places = placesFor()
  const place = placeOf(pathname)
  const pages = openProject ? projectPagesFor(openProject, userId) : []
  const page = openProject ? projectPageOf(pathname, openProject.project_id) : null
  const recent = recentProjects(projects, recentIds, cardProject?.project_id ?? null, 3)

  const [switcherOpen, setSwitcherOpen] = useState(false)
  const cardRef = useRef<HTMLButtonElement>(null)
  const closeSwitcher = useCallback((returnFocus: boolean) => {
    setSwitcherOpen(false)
    if (returnFocus) cardRef.current?.focus()
  }, [])

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const name = profile?.fullName || profile?.email || ''
  const go = onNavigate

  return (
    <nav className="ds-sidebar" data-open={open ? 'true' : undefined} aria-label="Main">
      <Link href="/home" className="ds-brand" onClick={go}>
        <PixelMark />
        <span>
          <span className="ds-brand-name" style={{ display: 'block' }}>
            LCAPIX
          </span>
          <span className="ds-brand-sub">Cost and carbon</span>
        </span>
      </Link>

      <div className="ds-nav">
        {places.map((p) => (
          <Link
            key={p}
            href={placeHref(p, openProject?.project_id ?? null)}
            className="ds-nav-item"
            aria-current={place === p ? 'page' : undefined}
            onClick={go}
          >
            <ShellIcon name={PLACE_ICON[p]} />
            {PLACE_LABEL[p]}
          </Link>
        ))}
      </div>

      <div className="ds-divider" />

      {cardProject ? (
        <div style={{ position: 'relative' }}>
          <button
            ref={cardRef}
            type="button"
            className="ds-switcher-card"
            aria-haspopup="dialog"
            aria-expanded={switcherOpen}
            onClick={() => setSwitcherOpen((o) => !o)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSwitcherOpen(true)
              }
            }}
          >
            <span className="ds-tile" style={{ background: projectTint(cardProject, projects) }} aria-hidden>
              {projectInitials(cardProject.project_name)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="ds-switcher-name" style={{ display: 'block' }} title={cardProject.project_name}>
                {cardProject.project_name}
              </span>
              <span className="ds-switcher-meta">
                {cardProject.is_sample && <Flag kind="sample" />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{projectMeta(cardProject, userId)}</span>
              </span>
            </span>
            <span style={{ color: 'var(--ds-text-3)' }}>
              <ShellIcon name="updown" size={16} />
            </span>
            <span className="ds-sr-only">Switch project</span>
          </button>
          {switcherOpen && (
            <ProjectSwitcher
              projects={projects}
              userId={userId}
              openId={openProject?.project_id ?? null}
              anchorRef={cardRef}
              onClose={closeSwitcher}
            />
          )}
        </div>
      ) : (
        status === 'ready' && (
          <p style={{ fontSize: 12, color: 'var(--ds-text-3)', margin: '0 10px' }}>No project yet.</p>
        )
      )}

      {openProject && (
        <div className="ds-nested" aria-label={`${openProject.project_name} pages`} role="group">
          {pages.map((pg) => (
            <Link
              key={pg}
              href={projectHref(openProject.project_id, pg)}
              className="ds-nav-item"
              aria-current={page === pg ? 'page' : undefined}
              onClick={go}
            >
              {PAGE_LABEL[pg]}
              {pg === 'cases' && <CountPill n={Number(openProject.case_count ?? 0)} label={`${openProject.case_count ?? 0} cases`} />}
              {pg === 'people' && (
                <CountPill n={peopleOn(openProject)} label={`${peopleOn(openProject)} people`} />
              )}
            </Link>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="ds-section-label" style={{ padding: '0 10px' }}>
            Recent
          </div>
          <div className="ds-recent">
            {recent.map((p) => (
              <Link key={p.project_id} href={projectHref(p.project_id)} className="ds-nav-item" onClick={go} title={p.project_name}>
                <span className="ds-tint-dot" style={{ background: projectTint(p, projects) }} aria-hidden />
                <span className="ds-recent-name">{p.project_name}</span>
                {p.is_sample && <Flag kind="sample" />}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="ds-nav" style={{ marginTop: 10 }}>
        <Link href="/home" className="ds-nav-item" onClick={go}>
          <ShellIcon name="grid" />
          All projects
          <CountPill n={projects.length} plain label={`${projects.length} projects`} />
          <ShellIcon name="chevron" size={16} />
        </Link>
        {showsNewProject(projects, userId) && (
          <Link href="/project/new" className="ds-nav-item" style={{ color: 'var(--ds-green)', fontWeight: 600 }} onClick={go}>
            <span style={{ color: 'var(--ds-green)', display: 'inline-flex' }}>
              <ShellIcon name="plus" />
            </span>
            New project
          </Link>
        )}
      </div>

      <div className="ds-spacer" />

      <Link href="/guide" className="ds-nav-item" onClick={go}>
        <ShellIcon name="help" />
        Help
      </Link>

      <div ref={menuRef} style={{ position: 'relative', marginTop: 4 }}>
        <button
          type="button"
          className="ds-profile ds-focusable"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={['Account menu', profile?.fullName || profile?.email || 'Your account', profile?.company]
            .filter(Boolean)
            .join(', ')}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="ds-avatar" aria-hidden>
            {initialsOf(name || 'You')}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.fullName || profile?.email || 'Your account'}
            </span>
            {profile?.company && (
              <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.company}
              </span>
            )}
          </span>
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="ds-popover"
            style={{ position: 'absolute', bottom: '100%', left: 0, width: 228, marginBottom: 6, padding: 6 }}
          >
            <MenuItem onClick={() => router.push('/profile')} icon="report">
              Profile
            </MenuItem>
            {isPlatformAdmin && (
              <MenuItem onClick={() => router.push('/admin/integrations')} icon="analytics">
                Integrations
              </MenuItem>
            )}
            <MenuItem onClick={() => signOut((path) => router.push(path))} icon="out">
              Log out
            </MenuItem>
          </div>
        )}
      </div>
    </nav>
  )
}

function MenuItem({ children, onClick, icon }: { children: string; onClick: () => void; icon: string }) {
  return (
    <button type="button" role="menuitem" className="ds-nav-item" onClick={onClick}>
      <ShellIcon name={icon} size={16} />
      {children}
    </button>
  )
}
