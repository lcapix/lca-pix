import { AppLayout } from "@/components/app-layout"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Leaf, Target, Users, Zap } from "lucide-react"

export default function AboutPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center mb-8">
            <Leaf className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-3xl font-bold mb-2">About LCAPIX</h1>
            <p className="text-muted-foreground text-lg">
              Professional Life Cycle Assessment platform for sustainable decision making
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Our Mission
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  To democratize Life Cycle Assessment by providing intuitive, powerful tools that enable organizations
                  to make data-driven sustainable decisions and reduce their environmental impact.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Key Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="secondary">Hierarchical Component Structure</Badge>
                <Badge variant="secondary">Base vs Comparative Analysis</Badge>
                <Badge variant="secondary">Cost Tracking</Badge>
                <Badge variant="secondary">Driver Category Management</Badge>
                <Badge variant="secondary">Real-time Collaboration</Badge>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Who We Serve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <h3 className="font-semibold mb-2">Sustainability Teams</h3>
                  <p className="text-sm text-muted-foreground">
                    Track and analyze environmental impact across product lifecycles
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <h3 className="font-semibold mb-2">Product Managers</h3>
                  <p className="text-sm text-muted-foreground">
                    Make informed decisions about product design and materials
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <h3 className="font-semibold mb-2">Consultants</h3>
                  <p className="text-sm text-muted-foreground">
                    Deliver comprehensive LCA reports to clients efficiently
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Platform Capabilities</CardTitle>
              <CardDescription>Comprehensive LCA management from project creation to assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Project Organization</h4>
                    <p className="text-sm text-muted-foreground">
                      Organize your LCA work into projects with multiple comparison cases
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Hierarchical Components</h4>
                    <p className="text-sm text-muted-foreground">
                      Build detailed process hierarchies from machine lines to elemental tasks
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Cost Analysis</h4>
                    <p className="text-sm text-muted-foreground">
                      Track operational and capital costs across all components
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Driver Management</h4>
                    <p className="text-sm text-muted-foreground">
                      Categorize and manage environmental drivers across energy, material, labor, and transport
                    </p>
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
