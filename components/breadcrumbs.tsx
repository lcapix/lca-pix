"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import { useProjectStore } from "@/lib/store"

export function Breadcrumbs() {
  const pathname = usePathname()
  const { projects } = useProjectStore()

  // Don't show breadcrumbs on auth pages or home
  if (pathname.startsWith("/auth") || pathname === "/home") {
    return null
  }

  const pathSegments = pathname.split("/").filter(Boolean)
  const breadcrumbs: { label: string; href: string; current?: boolean }[] = []

  // Always start with Home
  breadcrumbs.push({ label: "Home", href: "/home" })

  // Build breadcrumbs based on path
  if (pathSegments[0] === "project") {
    if (pathSegments[1] === "new") {
      breadcrumbs.push({ label: "New Project", href: "/project/new", current: true })
    } else if (pathSegments[1]) {
      const projectId = pathSegments[1]
      const project = projects.find((p) => p.id === projectId)

      if (project) {
        breadcrumbs.push({
          label: project.name,
          href: `/project/${projectId}`,
          current: pathSegments.length === 2,
        })

        if (pathSegments[2] === "case") {
          if (pathSegments[3] === "base" && pathSegments[4] === "new") {
            breadcrumbs.push({ 
              label: "Project Setup", 
              href: `/project/${projectId}`, 
              current: false 
            })
            breadcrumbs.push({ label: "Create Base Case", href: pathname, current: true })
          } else if (pathSegments[3] === "comparative" && pathSegments[4] === "new") {
            breadcrumbs.push({ 
              label: "Project Setup", 
              href: `/project/${projectId}`, 
              current: false 
            })
            breadcrumbs.push({ label: "Create Comparative Case", href: pathname, current: true })
          } else if (pathSegments[3]) {
            const caseId = pathSegments[3]
            const case_ = project.cases.find((c) => c.id === caseId)

            if (case_) {
              // Only show case name if we're not on the case dashboard page
              if (pathSegments.length > 4) {
                breadcrumbs.push({
                  label: case_.name,
                  href: `/project/${projectId}/case/${caseId}`,
                  current: false,
                })
              } else {
                // On the case dashboard page, show the case name as the current page
                breadcrumbs.push({
                  label: case_.name,
                  href: `/project/${projectId}/case/${caseId}`,
                  current: true,
                })
              }

              if (pathSegments[4] === "component" && pathSegments[5] === "new") {
                breadcrumbs.push({ label: "New Component", href: pathname, current: true })
              } else if (pathSegments[4] === "results") {
                breadcrumbs.push({ label: "Results", href: pathname, current: true })
              }
            }
          }
        }
      }
    }
  } else if (pathSegments[0] === "guide") {
    breadcrumbs.push({ label: "Guide", href: "/guide", current: true })
  } else if (pathSegments[0] === "about") {
    breadcrumbs.push({ label: "About", href: "/about", current: true })
  }

  // Don't show breadcrumbs if there's only Home
  if (breadcrumbs.length <= 1) {
    return null
  }

  return (
    <nav className="border-b bg-muted/30 px-4 py-2">
      <div className="container">
        <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <li key={`${crumb.href}-${index}`} className="flex items-center">
              {index > 0 && <ChevronRight className="h-4 w-4 mx-2" />}
              {crumb.current ? (
                <span className="text-foreground font-medium">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {index === 0 && <Home className="h-4 w-4 mr-1 inline" />}
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}
