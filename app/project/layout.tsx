import type React from "react"
import { AppTopBar } from "@/components/lcapix"
import { GlobalTour } from "@/components/global/global-tour"
import { SignedIn } from "@/components/lcapix/shell/signed-in"

/**
 * Project layout: the auth gate and the education shell (sidebar) on every
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
      {/* Mounts the guided tour on all project routes so the nav Tour button
          can launch it contextually (without bouncing to /home). */}
      <GlobalTour />
    </SignedIn>
  )
}
