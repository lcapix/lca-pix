import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppShell } from "@/components/layout/app-shell"

/**
 * Project layout — auth gate + Veridian top nav.
 *
 * Individual project pages may further wrap their content in
 * <ProjectShell> for the contextual left rail, but the top nav
 * (AppShell) is provided once here so every project page gets it
 * without having to repeat the wrapper.
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requireAuth={true}>
      <AppShell activeHref="/home">{children}</AppShell>
    </AuthGuard>
  )
}
