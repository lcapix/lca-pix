"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useProjectStore } from "@/lib/store"
import { ArrowLeft, Plus, Edit, Trash2, Lock } from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const { projects, deleteCase } = useProjectStore()
  const [project, setProject] = useState(null)

  useEffect(() => {
    const foundProject = projects.find((p) => p.id === projectId)
    if (!foundProject) {
      toast({
        title: "Project not found",
        description: "The requested project could not be found.",
        variant: "destructive",
      })
      router.push("/home")
      return
    }
    setProject(foundProject)
  }, [projectId, projects, router])

  if (!project) {
    return (
      <div className="container max-w-6xl mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Loading project...</h2>
          </div>
        </div>
      </div>
    )
  }

  const baseCases = project.cases?.filter((c) => c.type === "base") || []
  const comparativeCases = project.cases?.filter((c) => c.type === "comparative") || []
  const hasBaseCase = baseCases.length > 0
  const hasComparativeCases = comparativeCases.length > 0

  const handleDeleteCase = (caseId: string) => {
    if (confirm("Are you sure you want to delete this case? This action cannot be undone.")) {
      deleteCase(projectId, caseId)
      toast({
        title: "Case deleted",
        description: "The case has been removed from your project.",
      })
    }
  }

  return (
    <div className="container max-w-6xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.description && <p className="text-muted-foreground mt-2">{project.description}</p>}
          </div>
        </div>
      </div>

      {/* Cases Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Base Case */}
        <div className="space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Base Case</h2>
          </div>

          {hasBaseCase ? (
            <div className="space-y-3 flex-grow">
              {baseCases.map((baseCase) => (
                <Card key={baseCase.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">{baseCase.name}</CardTitle>
                          <Badge variant="secondary">Base</Badge>
                        </div>
                        <CardDescription>{baseCase.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCase(baseCase.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Link href={`/project/${projectId}/case/${baseCase.id}`}>
                      <Button variant="outline" size="sm">
                        Open Case
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed h-full min-h-[240px] flex-grow">
              <CardContent className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">You have no Base Case created yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    A base case serves as your reference scenario for comparison with one product.
                  </p>
                </div>
                <Link href={`/project/${projectId}/case/base/new`}>
                  <Button>Create your Base Case</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Comparative Cases */}
        <div className="space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Comparative Cases</h2>
            {hasComparativeCases && hasBaseCase && (
              <Link href={`/project/${projectId}/case/comparative/new`}>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Case
                </Button>
              </Link>
            )}
          </div>

          {hasComparativeCases ? (
            <div className="space-y-3 flex-grow">
              {comparativeCases.map((compCase) => (
                <Card key={compCase.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">{compCase.name}</CardTitle>
                          <Badge variant="outline">Comparative</Badge>
                        </div>
                        <CardDescription>{compCase.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCase(compCase.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Link href={`/project/${projectId}/case/${compCase.id}`}>
                      <Button variant="outline" size="sm">
                        Open Case
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}

              {/* Add more comparative cases button - only show if base case exists */}
              {hasBaseCase && (
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-center py-8">
                    <Link href={`/project/${projectId}/case/comparative/new`}>
                      <Button variant="ghost" className="h-auto py-4">
                        <Plus className="h-5 w-5 mr-2" />
                        Add a comparative case
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className={`border-dashed h-full min-h-[240px] flex-grow ${!hasBaseCase ? 'bg-muted/50 opacity-60' : ''}`}>
              <CardContent className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="mb-4">
                  {!hasBaseCase && (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3 mx-auto">
                      <Lock className="h-6 w-6 text-gray-500" />
                    </div>
                  )}
                  <h3 className="font-semibold mb-2">
                    {!hasBaseCase ? 'Comparative Cases Locked' : 'No Comparative Case created yet'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {!hasBaseCase 
                      ? 'Create a Base Case first before adding comparative scenarios.'
                      : 'Comparative cases are alternative scenarios to compare against your base case.'
                    }
                  </p>
                </div>
                {hasBaseCase ? (
                  <Link href={`/project/${projectId}/case/comparative/new`}>
                    <Button variant="outline">Create a comparative case</Button>
                  </Link>
                ) : (
                  <Button 
                    variant="outline" 
                    disabled 
                    className="cursor-not-allowed opacity-50"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Create a comparative case
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Action Bar */}
      {(hasBaseCase || hasComparativeCases) && (
        <div className="mt-8 flex justify-end">
          <Button size="lg">Run Assessment</Button>
        </div>
      )}
    </div>
  )
}
