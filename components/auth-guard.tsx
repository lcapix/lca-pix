"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store"

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()

  // Wait for Zustand persist middleware to hydrate from localStorage before
  // deciding to redirect. Otherwise, a hard navigation to a protected page
  // renders with isAuthenticated=false during the first client render and
  // bounces the user back to /auth/login even when a valid token is stored.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (requireAuth && !isAuthenticated) {
      router.push("/auth/login")
    } else if (!requireAuth && isAuthenticated) {
      router.push("/home")
    }
  }, [hydrated, isAuthenticated, requireAuth, router])

  if (!hydrated || (requireAuth && !isAuthenticated) || (!requireAuth && isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <>{children}</>
}
