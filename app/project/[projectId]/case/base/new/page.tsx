"use client"
import { useState } from "react"
import type React from "react"

import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useProjectStore } from "@/lib/store"
import { toast } from "sonner"

export default function CreateBaseCasePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const { addCase, addProject, projects } = useProjectStore()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] Creating base case with data:", formData)

    if (!formData.name.trim()) {
      toast.error("Please enter a case name")
      return
    }

    setIsSubmitting(true)

    try {
      let project = projects.find((p) => p.id === projectId)
      if (!project) {
        console.log("[v0] Project not found, creating new project with ID:", projectId)
        addProject({
          id: projectId,
          name: formData.name.trim(),
          description: "LCA Project created from base case",
          ownerId: "current-user", // This should be the actual user ID
        })
        // Get the updated projects after adding
        const updatedProjects = useProjectStore.getState().projects
        project = updatedProjects.find((p) => p.id === projectId)
        console.log("[v0] Created project:", project)
      }

      const caseId = crypto.randomUUID()
      console.log("[v0] Generated case ID:", caseId)

      const caseData = {
        id: caseId,
        projectId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: "base" as const,
      }

      console.log("[v0] About to call addCase with:", { projectId, caseData })
      addCase(projectId, caseData)
      console.log("[v0] addCase completed")

      const { projects: finalProjects } = useProjectStore.getState()
      console.log("[v0] Store state after addCase:", finalProjects)
      const finalProject = finalProjects.find((p) => p.id === projectId)
      console.log("[v0] Found project:", finalProject)
      if (finalProject) {
        console.log("[v0] Project cases:", finalProject.cases)
        const foundCase = finalProject.cases.find((c) => c.id === caseId)
        console.log("[v0] Found case in store:", foundCase)
      }

      toast.success("Base case created successfully!")
      console.log("[v0] Base case created, navigating to case view")

      // Navigate to the case view
      router.push(`/project/${projectId}/case/${caseId}`)
    } catch (error) {
      console.error("[v0] Error creating base case:", error)
      toast.error("Failed to create base case")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = formData.name.trim().length > 0

  return (
    <div className="container max-w-2xl mx-auto py-8">
      <div className="mb-6">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <Link href="/home" className="hover:text-foreground">Home</Link>
          <span>→</span>
          <Link href={`/project/${projectId}`} className="hover:text-foreground">
            {projects.find(p => p.id === projectId)?.name || "Project"}
          </Link>
          <span>→</span>
          <span className="text-foreground font-medium">Create Base Case</span>
        </div>
        <h1 className="text-3xl font-bold">Create your Base Case</h1>
        <p className="text-muted-foreground mt-2">Define the reference scenario for your LCA project.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Base Case Details</CardTitle>
          <CardDescription>
            The base case represents your current or reference process that will serve as the baseline for comparison.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Case Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Current Production Process"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                maxLength={60}
                required
              />
              <p className="text-xs text-muted-foreground">{formData.name.length}/60 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your base case scenario, including key processes, materials, and assumptions..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Optional: Provide additional context about this base case</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isFormValid || isSubmitting} className="flex-1">
                {isSubmitting ? "Creating..." : "Create Base Case"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">What is a Base Case?</h3>
        <p className="text-sm text-blue-800">
          Your base case establishes the reference scenario against which all comparative cases will be measured. It
          typically represents your current process, standard practice, or the scenario you want to improve upon.
        </p>
        <p className="text-sm text-blue-800 mt-2">
          <strong>Note:</strong> Each base case is designed to analyze a single product. This ensures clear and focused 
          lifecycle assessment results.
        </p>
      </div>
    </div>
  )
}
