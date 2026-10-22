import type React from "react"
import { AppTopBar } from "@/components/lcapix"
import { SignedIn } from "@/components/lcapix/shell/signed-in"

/**
 * Project layout: the auth gate and the shell (sidebar) on every
 * project route. AppTopBar steps aside inside the shell; with the shell
 * switched off (NEXT_PUBLIC_LCAPIX_SHELL=classic) it is the nav again.
 * Individual pages can still lay out their own panes (the case editor).
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SignedIn>
      <AppTopBar current="home" />
      {children}
    </SignedIn>
  )
}
