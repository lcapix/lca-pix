"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"

/**
 * OAuth callback landing page.
 *
 * The /api/auth/google server route handles the OAuth code exchange and sets
 * two cookies (auth_token and user_data), then redirects here. This client
 * page promotes those cookies into:
 *   - localStorage.auth_token / localStorage.user — used by lib/api-client for
 *     Authorization headers
 *   - the Zustand auth store (lcapix-auth) — used by AuthGuard to decide if a
 *     route is accessible
 *
 * Without this sync step, /home mounts with isAuthenticated=false and the
 * AuthGuard bounces the user straight back to /auth/login.
 */
export default function OAuthCallbackPage() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const { toast } = useToast()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const readCookie = (name: string): string | null => {
      const match = document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${name}=`))
      if (!match) return null
      return decodeURIComponent(match.slice(name.length + 1))
    }

    try {
      const token = readCookie("auth_token")
      const rawUser = readCookie("user_data")

      if (!token || !rawUser) {
        throw new Error(
          "Missing auth cookies after OAuth callback. Try signing in again."
        )
      }

      const parsed = JSON.parse(rawUser) as {
        id: number | string
        username: string
        email: string
      }

      localStorage.setItem("auth_token", token)
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: parsed.id,
          username: parsed.username,
          email: parsed.email,
        })
      )

      login({
        id: String(parsed.id),
        name: parsed.username,
        email: parsed.email,
        createdAt: new Date(),
      })

      toast({
        title: "Welcome!",
        description: "Signed in with Google.",
      })

      router.replace("/home")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OAuth sign-in failed."
      toast({
        title: "Sign-in failed",
        description: message,
        variant: "destructive",
      })
      router.replace("/auth/login?error=oauth_sync_failed")
    }
  }, [login, router, toast])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}
