import { AppLayout } from "@/components/app-layout"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BookOpen, ArrowRight, Plus, FolderPlus, Component } from "lucide-react"

export default function GuidePage() {
  return (
    <AuthGuard>
      <AppLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center mb-8">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-3xl font-bold mb-2">LCAPIX Guide</h1>
            <p className="text-muted-foreground text-lg">
              Learn how to create and manage Life Cycle Assessment projects
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Getting Started
                </CardTitle>
                <CardDescription>Create your first LCA project and understand the basics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Start by creating a new project to organize your Life Cycle Assessment work. Each project can contain
                  multiple cases for comparison.
                </p>
                <Link href="/project/new">
                  <Button className="w-full">
                    Create Your First Project
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderPlus className="h-5 w-5 text-primary" />
                  Understanding Cases
                </CardTitle>
                <CardDescription>Learn about Base and Comparative cases</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Base cases represent your reference scenario, while comparative cases represent alternatives for A/B
                  comparison and analysis.
                </p>
                <Button variant="outline" className="w-full bg-transparent" disabled>
                  Select a Project First
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Component className="h-5 w-5 text-primary" />
                  Building Components
                </CardTitle>
                <CardDescription>Create hierarchical component structures</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Components represent different process types in your LCA hierarchy: Machine Line Process, Subprocess,
                  Operation, and Elemental Task.
                </p>
                <Button variant="outline" className="w-full bg-transparent" disabled>
                  Select a Case First
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Process Types</CardTitle>
                <CardDescription>Understanding the component hierarchy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="font-medium">Machine Line Process</span> - Top level
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <div className="w-2 h-2 bg-primary/70 rounded-full"></div>
                    <span className="font-medium">Subprocess</span> - Mid level
                  </div>
                  <div className="flex items-center gap-2 ml-8">
                    <div className="w-2 h-2 bg-primary/50 rounded-full"></div>
                    <span className="font-medium">Operation</span> - Detailed level
                  </div>
                  <div className="flex items-center gap-2 ml-12">
                    <div className="w-2 h-2 bg-primary/30 rounded-full"></div>
                    <span className="font-medium">Elemental Task</span> - Granular level
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Keyboard Shortcuts</CardTitle>
              <CardDescription>Speed up your workflow with these shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Open Command Palette</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">⌘K</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">New Project</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">N P</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">New Case</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">N C</kbd>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">New Component</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">N M</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Delete Selected</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">Del</kbd>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </AuthGuard>
  )
}
