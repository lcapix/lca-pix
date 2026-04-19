import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppTopBar } from "@/components/lcapix"

/**
 * Project layout — auth gate + LCAPIX top nav.
 *
 * Replaced the legacy Stitch-era AppShell with the LCAPIX AppTopBar
 * (the same nav shown on /home) so every authenticated route shares
 * a single visual language. Individual pages can still wrap content
 * in their own shells (e.g. case editor's 3-pane layout).
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requireAuth={true}>
      <AppTopBar current="home" />
      {children}
    </AuthGuard>
  )
}
