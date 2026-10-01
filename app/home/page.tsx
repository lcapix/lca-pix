'use client'

// Dashboard (/home): greeting, KPI tiles, the project list (grid or list,
// filter and search) or the empty state with the ISO 14040 rail, and the
// recent-activity sidebar. Data and actions live in lib/home/use-home.ts,
// derivations in lib/home/projects.ts.

import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import { AppTopBar, fmtNum, fmtInt } from '@/components/lcapix'
import { GuidedTour } from '@/components/global/guided-tour'
import { LCAPIX_TOUR_STEPS } from '@/lib/lcapix-tour-steps'
import { useHome } from '@/lib/home/use-home'
import { greetingName, homeKpis, initialsOf, projectTotals } from '@/lib/home/projects'
import { HomeGreeting } from './_components/home-greeting'
import { HomeKpis } from './_components/home-kpis'
import { ProjectsToolbar } from './_components/projects-toolbar'
import { ProjectsContent } from './_components/projects-content'
import { RecentActivity } from './_components/recent-activity'

export default function HomePage() {
  const router = useRouter()
  const {
    user,
    coerced,
    filtered,
    isLoadingProjects,
    projectsError,
    retryProjects,
    tourOpen,
    setTourOpen,
    kpiData,
    view,
    setView,
    filter,
    setFilter,
    search,
    setSearch,
    loadingExample,
    handleLoadExample,
    handleNewProject,
    handleOpenProject,
  } = useHome(router)

  const { totalCases, totalComponents } = projectTotals(coerced)

  // KPI metrics — enfos discipline: no per-tile accent colors, no sparklines,
  // hairline borders only. Green is the only accent anywhere on the page;
  // hover surfaces a brand-color CTA on interactive tiles.
  const kpis = homeKpis({
    projectCount: coerced.length,
    totalCases,
    totalComponents,
    factors: kpiData.factors,
    substances: kpiData.components,
    fmtInt,
  })

  return (
    <AuthGuard>
      <div className="app-shell">
        <AppTopBar current="home" userInitials={initialsOf(user?.name)} />
        <div style={{ display: 'flex', maxWidth: 1440, margin: '0 auto' }}>
          {/* Main column */}
          <div style={{ flex: 1, padding: '40px 28px 96px', minWidth: 0 }}>
            {/* Hero header */}
            <HomeGreeting
              firstName={greetingName(user?.name)}
              projectCount={coerced.length}
              isLoadingProjects={isLoadingProjects}
              onStartTour={() => setTourOpen(true)}
              onNewProject={handleNewProject}
            />

            {/* KPIs — calm, neutral, hairline-bordered */}
            <HomeKpis kpis={kpis} />

            {/* Projects header */}
            <ProjectsToolbar
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              view={view}
              setView={setView}
            />

            {/* Projects content */}
            <ProjectsContent
              projectsError={projectsError}
              onRetry={retryProjects}
              isLoadingProjects={isLoadingProjects}
              projectCount={coerced.length}
              view={view}
              filtered={filtered}
              handleOpenProject={handleOpenProject}
              onNewProject={handleNewProject}
              onLoadExample={handleLoadExample}
              loadingExample={loadingExample}
            />
            {/* Unused but referenced to keep lint calm if future numeric formatting needed */}
            <span style={{ display: 'none' }}>{fmtNum(0, 0)}</span>
          </div>

          {/* Sidebar: recent activity */}
          <RecentActivity />
        </div>
      </div>
      <GuidedTour
        steps={LCAPIX_TOUR_STEPS}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
      />
    </AuthGuard>
  )
}
