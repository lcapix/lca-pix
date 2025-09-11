"use client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { useProjectStore } from "@/lib/store"
import { toast } from "sonner"

export default function NewProjectPage() {
  const router = useRouter()
  const { addProject } = useProjectStore()
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })
  const [errors, setErrors] = useState({ name: "", description: "" })

  const validateForm = () => {
    const newErrors = { name: "", description: "" }
    
    if (!formData.name.trim()) {
      newErrors.name = "Project name is required"
    }
    
    setErrors(newErrors)
    return !newErrors.name
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    // Create the project
    const projectId = crypto.randomUUID()
    addProject({
      id: projectId,
      name: formData.name.trim(),
      description: formData.description.trim(),
      ownerId: "current-user-id", // This would come from auth context
    })
    
    toast.success(`Project "${formData.name}" created successfully!`)
    
    // Navigate to project dashboard
    router.push(`/project/${projectId}`)
  }

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <Link
          href="/home"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        <h1 className="text-3xl font-bold">Create New LCA Project</h1>
        <p className="text-muted-foreground mt-2">
          Start by giving your project a name and description. You'll create cases within this project next.
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Project Information</CardTitle>
          <CardDescription>
            Provide basic information about your LCA project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="projectName" className="text-sm font-medium">
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="projectName"
                placeholder="e.g., Limited Lifecycle Analysis of Buckets"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  if (errors.name) {
                    setErrors({ ...errors, name: "" })
                  }
                }}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
              <p className="text-xs text-gray-500">
                Choose a descriptive name that identifies your project
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectDescription" className="text-sm font-medium">
                Project Description
              </Label>
              <Textarea
                id="projectDescription"
                placeholder="e.g., Comparing plastic and aluminium bucket manufacturing processes"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value })
                }}
                rows={4}
              />
              <p className="text-xs text-gray-500">
                Optional: Provide additional context about your project goals and scope
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Create Project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200 max-w-2xl mx-auto">
        <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
        <p className="text-sm text-blue-800">
          After creating your project, you'll be taken to the project dashboard where you can:
        </p>
        <ul className="text-sm text-blue-800 mt-2 space-y-1">
          <li>• Create a Base Case (reference scenario)</li>
          <li>• Add Comparative Cases (alternative scenarios)</li>
          <li>• Manage project settings and collaborators</li>
        </ul>
      </div>
    </div>
  )
}
