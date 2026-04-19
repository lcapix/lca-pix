"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { AppShell } from "@/components/layout/app-shell"
import { KpiCardRow } from "@/components/dashboard/kpi-card-row"
import { ActivePortfolio } from "@/components/dashboard/active-portfolio"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuthStore, useProjectStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/api-client"
import { transformProjectFromDB } from "@/lib/data-transformers"
import { formatDistanceToNow } from "date-fns"

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy] = useState<"recent" | "name">("recent")
  const [sortOrder] = useState<"asc" | "desc">("desc")
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<any | null>(null)
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false)

  const router = useRouter()
  const { user } = useAuthStore()
  const { projects, setProjects, deleteProject, setCurrentProject } = useProjectStore()
  const { toast } = useToast()
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)

  // NEW: dashboard integrations data
  const [kpiData, setKpiData] = useState({ assessments: 0, factors: 0, components: 0 })
  const [activityItems, setActivityItems] = useState<any[]>([])

  // Fetch projects from database on mount
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return

      setIsLoadingProjects(true)
      try {
        const response = await apiRequest("/api/projects")
        const data = await response.json()

        if (data.success && data.projects) {
          const transformedProjects = data.projects.map((p: any) => transformProjectFromDB(p))
          setProjects(transformedProjects)
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error)
        toast({
          title: "Error",
          description: "Failed to load projects from database",
          variant: "destructive",
        })
      } finally {
        setIsLoadingProjects(false)
      }
    }

    fetchProjects()
  }, [user, setProjects, toast])

  // Fetch dashboard KPI + activity feed data
  useEffect(() => {
    if (!user) return
    Promise.all([
      apiRequest("/api/integrations/status").then((r) => r.json()).catch(() => null),
      apiRequest("/api/integrations/log?limit=6").then((r) => r.json()).catch(() => null),
    ]).then(([status, log]) => {
      if (status?.success) {
        const totalFactors = (status.factorsByMethod ?? []).reduce(
          (s: number, m: any) => s + Number(m.factors ?? 0),
          0,
        )
        const totalSubstances = Number(status.substances?.total ?? 0)
        setKpiData((k) => ({ ...k, factors: totalFactors, components: totalSubstances }))
      }
      if (log?.success) setActivityItems(log.logs ?? [])
    })
  }, [user])

  const filteredProjects = projects
    .filter((project) => project.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "recent") {
        const dateA = new Date(a.updatedAt).getTime()
        const dateB = new Date(b.updatedAt).getTime()
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB
      } else {
        return sortOrder === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
      }
    })

  const handleDeleteProject = (projectId: string) => {
    console.log("[v0] Delete project clicked:", projectId)
    deleteProject(projectId)
    setDeleteProjectId(null)
    toast({
      title: "Project deleted",
      description: "The project has been successfully deleted.",
    })
  }

  const handleOpenProject = (projectId: string) => {
    console.log("[v0] Open project clicked:", projectId)
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      setCurrentProject(project)
    }
    router.push(`/project/${projectId}`)
  }

  const totalCases = projects.reduce(
    (s, p: any) => s + Number(p.caseCount ?? p.cases?.length ?? 0),
    0,
  )

  const kpis = [
    {
      label: "Active Projects",
      value: projects.length,
      delta: projects.length > 0 ? `${projects.length} total` : "None yet",
    },
    {
      label: "Assessments",
      value: totalCases,
      delta: "across all cases",
    },
    {
      label: "Factors Logged",
      value: kpiData.factors,
      delta: "via integrations",
    },
    {
      label: "Components",
      value: kpiData.components,
      delta: "substances catalog",
    },
  ]

  return (
    <AuthGuard>
      <AppShell activeHref="/home">
        <div className="max-w-[1440px] mx-auto px-6 md:px-10 py-12">
          {/* Eyebrow */}
          <div className="font-mono text-xs uppercase tracking-[0.15em] text-primary mb-4">
            Precision Botanical Data
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-on-surface">
            Systems Overview
          </h1>
          <p className="mt-3 text-on-surface-variant max-w-2xl">
            Botanical precision in environmental asset management. Welcome back,{" "}
            {user?.name ?? "engineer"}.
          </p>

          {/* KPI row */}
          <div className="mt-10">
            <KpiCardRow kpis={kpis} />
          </div>

          {/* Main + sidebar */}
          <div className="mt-12 grid lg:grid-cols-[1fr_320px] gap-8">
            <ActivePortfolio
              projects={filteredProjects as any}
              isLoading={isLoadingProjects}
              onOpen={handleOpenProject}
              onDelete={(projectId) => setDeleteProjectId(projectId)}
              onNew={() => {
                try {
                  router.push("/project/new")
                } catch {
                  window.location.href = "/project/new"
                }
              }}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
            />

            <ActivityFeed
              items={activityItems}
              onGenerateReport={() =>
                toast({
                  title: "Coming soon",
                  description: "EIA report generation will be available soon.",
                })
              }
            />
          </div>

          {/* Delete confirmation dialog */}
          <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;
                  {projects.find((p) => p.id === deleteProjectId)?.name}&quot;? This action cannot
                  be undone and will permanently delete all cases and components within this
                  project.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteProjectId && handleDeleteProject(deleteProjectId)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Project Description Modal */}
          <Dialog open={isDescriptionModalOpen} onOpenChange={setIsDescriptionModalOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedProject?.name}</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Project Description</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {selectedProject?.description}
                </p>
                {selectedProject && (
                  <div className="mt-6 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Total Cases:</span>{" "}
                        <span className="font-medium">
                          {selectedProject.caseCount ?? selectedProject.cases?.length ?? 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Updated:</span>{" "}
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(selectedProject.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </AppShell>
    </AuthGuard>
  )
}
