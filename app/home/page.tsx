"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { useAuthStore, useProjectStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink,
  SortAsc,
  SortDesc,
  Clock,
  FileText,
  BookOpen,
  Download,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"recent" | "name">("recent")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)

  const router = useRouter()
  const { user } = useAuthStore()
  const { projects, deleteProject, setCurrentProject } = useProjectStore()
  const { toast } = useToast()

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
      console.log("[v0] Navigating to:", `/project/${projectId}`)
      try {
        console.log("[v0] Router object:", router)
        console.log("[v0] Attempting router.push...")
        router.push(`/project/${projectId}`)
        console.log("[v0] Router.push completed")
      } catch (error) {
        console.error("[v0] Router.push failed:", error)
        console.log("[v0] Trying window.location fallback...")
        window.location.href = `/project/${projectId}`
      }
    }
  }

  const toggleSort = () => {
    console.log("[v0] Toggle sort clicked")
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  const hasProjects = projects.length > 0

  return (
    <AuthGuard>
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          {/* Greeting */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {hasProjects ? `Welcome back, ${user?.name}!` : `Welcome, ${user?.name}!`}
            </h1>
            <p className="text-muted-foreground">
              {hasProjects
                ? "Continue working on your LCA projects or start a new one."
                : "Get started with your first Life Cycle Assessment project."}
            </p>
          </div>

          {/* No projects state */}
          {!hasProjects && (
            <div className="max-w-2xl mx-auto">
              <EmptyState
                icon={FileText}
                title="You have no projects created yet"
                description="Create your first LCA project to start analyzing environmental impacts and making sustainable decisions."
                primaryAction={{
                  label: "Create your first project",
                  onClick: () => {
                    console.log("[v0] Create first project clicked")
                    try {
                      console.log("[v0] Router object:", router)
                      console.log("[v0] Attempting router.push to /project/new...")
                      router.push("/project/new")
                      console.log("[v0] Router.push completed")
                    } catch (error) {
                      console.error("[v0] Router.push failed:", error)
                      console.log("[v0] Trying window.location fallback...")
                      window.location.href = "/project/new"
                    }
                  },
                }}
                secondaryActions={[
                  {
                    label: "Import a template project",
                    onClick: () => {
                      console.log("[v0] Import template clicked")
                      toast({
                        title: "Coming soon",
                        description: "Template import functionality will be available soon.",
                      })
                    },
                    icon: Download,
                  },
                  {
                    label: "Read the Guide",
                    onClick: () => {
                      console.log("[v0] Read guide clicked")
                      try {
                        console.log("[v0] Router object:", router)
                        console.log("[v0] Attempting router.push to /guide...")
                        router.push("/guide")
                        console.log("[v0] Router.push completed")
                      } catch (error) {
                        console.error("[v0] Router.push failed:", error)
                        console.log("[v0] Trying window.location fallback...")
                        window.location.href = "/guide"
                      }
                    },
                    icon: BookOpen,
                  },
                ]}
              />
            </div>
          )}

          {/* Has projects state */}
          {hasProjects && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Projects</CardTitle>
                    <CardDescription>Manage and access your LCA projects</CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      console.log("[v0] New Project button clicked")
                      try {
                        console.log("[v0] Router object:", router)
                        console.log("[v0] Attempting router.push to /project/new...")
                        router.push("/project/new")
                        console.log("[v0] Router.push completed")
                      } catch (error) {
                        console.error("[v0] Router.push failed:", error)
                        console.log("[v0] Trying window.location fallback...")
                        window.location.href = "/project/new"
                      }
                    }}
                    className="btn-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                  </Button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-4 pt-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="bg-transparent">
                        {sortBy === "recent" ? (
                          <Clock className="mr-2 h-4 w-4" />
                        ) : (
                          <FileText className="mr-2 h-4 w-4" />
                        )}
                        Sort by {sortBy}
                        {sortOrder === "desc" ? (
                          <SortDesc className="ml-2 h-4 w-4" />
                        ) : (
                          <SortAsc className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSortBy("recent")
                          if (sortBy !== "recent") setSortOrder("desc")
                          else toggleSort()
                        }}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Recent
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSortBy("name")
                          if (sortBy !== "name") setSortOrder("asc")
                          else toggleSort()
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Name
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent>
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-8">
                    <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No projects found</h3>
                    <p className="text-muted-foreground">Try adjusting your search terms</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          console.log("[v0] Project card clicked:", project.id)
                          handleOpenProject(project.id)
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">{project.name}</h3>
                              <p className="text-sm text-muted-foreground truncate">{project.description}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{project.cases.length} cases</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                            </p>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  console.log("[v0] Dropdown trigger clicked")
                                  e.stopPropagation()
                                }}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  console.log("[v0] Open menu item clicked")
                                  e.stopPropagation()
                                  try {
                                    console.log("[v0] Router object:", router)
                                    console.log("[v0] Attempting router.push...")
                                    handleOpenProject(project.id)
                                    console.log("[v0] handleOpenProject completed")
                                  } catch (error) {
                                    console.error("[v0] handleOpenProject failed:", error)
                                  }
                                }}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  console.log("[v0] Edit menu item clicked")
                                  e.stopPropagation()
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit name
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  console.log("[v0] Delete menu item clicked")
                                  e.stopPropagation()
                                  setDeleteProjectId(project.id)
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Delete confirmation dialog */}
          <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{projects.find((p) => p.id === deleteProjectId)?.name}&quot;? This action
                  cannot be undone and will permanently delete all cases and components within this project.
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
        </div>
      </AppLayout>
    </AuthGuard>
  )
}
