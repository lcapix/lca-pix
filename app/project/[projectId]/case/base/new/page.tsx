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
import { apiRequest } from "@/lib/api-client"

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
      // POST to real API — source of truth is AWS RDS.
      const res = await apiRequest(`/api/projects/${projectId}/cases`, {
        method: "POST",
        body: JSON.stringify({
          case_name: formData.name.trim(),
          case_type: "base",
          description: formData.description.trim() || null,
        }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText)
        throw new Error(msg || `POST failed (${res.status})`)
      }
      const data = await res.json().catch(() => ({}))
      const newId = data?.case?.case_id ?? data?.case_id
      const caseId = newId ? String(newId) : crypto.randomUUID()

      // Mirror to Zustand for optimistic UI
      const caseData = {
        id: caseId,
        projectId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: "base" as const,
      }
      addCase(projectId, caseData)

      toast.success("Base case created")
      router.push(`/project/${projectId}/case/${caseId}`)
    } catch (error: any) {
      console.error("Error creating base case:", error)
      toast.error(error?.message || "Failed to create base case")
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
