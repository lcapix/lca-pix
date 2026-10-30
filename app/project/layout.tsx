import type React from "react"
import { SignedIn } from "@/components/lcapix/shell/signed-in"

/**
 * Project layout: the auth gate and the education shell (sidebar) on every
 * project route. Individual pages can still lay out their own panes (the case
 * editor).
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SignedIn>{children}</SignedIn>
}
