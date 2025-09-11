import type React from "react"
import { AppLayout } from "@/components/app-layout"
import { AuthGuard } from "@/components/auth-guard"

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requireAuth={true}>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  )
}
