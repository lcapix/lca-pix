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

export default function CreateComparativeCasePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const { addCase, projects } = useProjectStore()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get project info for display
  const project = projects.find((p) => p.id === projectId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error("Please enter a case name")
      return
    }

    setIsSubmitting(true)

    try {
      const caseId = crypto.randomUUID()

      const caseData = {
        id: caseId,
        projectId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: "comparative" as const,
      }

      addCase(projectId, caseData)
      toast.success("Comparative case created successfully!")

      // Navigate to the case view
      router.push(`/project/${projectId}/case/${caseId}`)
    } catch (error) {
      console.error("Error creating comparative case:", error)
      toast.error("Failed to create comparative case")
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
            {project?.name || "Project"}
          </Link>
          <span>→</span>
          <span className="text-foreground font-medium">Create Comparative Case</span>
        </div>
        <h1 className="text-3xl font-bold">Create Comparative Case</h1>
        <p className="text-muted-foreground mt-2">
          Define an alternative scenario to compare against your base case.
        </p>
        {project && (
          <p className="text-sm text-blue-600 mt-2">
            Project: <span className="font-medium">{project.name}</span>
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparative Case Details</CardTitle>
          <CardDescription>
            A comparative case represents an alternative process or scenario that you want to compare against your base case.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Case Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Alternative Material Process"
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
                placeholder="Describe this alternative scenario, including what changes from the base case..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Optional: Explain how this case differs from your base case</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isFormValid || isSubmitting} className="flex-1">
                {isSubmitting ? "Creating..." : "Create Comparative Case"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">What is a Comparative Case?</h3>
        <p className="text-sm text-blue-800">
          Comparative cases allow you to model alternative scenarios, processes, or materials to compare their environmental
          impact against your base case. This helps you identify which options have better or worse environmental performance.
        </p>
      </div>
    </div>
  )
}