"use client"

import { Suspense, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
 *
 * Why the Suspense wrapper: useSearchParams forces the page off the static
 * prerender path. Wrapping the consumer in <Suspense> tells Next.js it's
 * intentional and is the documented escape hatch.
 */
export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackInner />
    </Suspense>
  )
}

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const { toast } = useToast()
  const ran = useRef(false)

  // Whitelist destination paths to avoid open-redirect attacks via ?next=.
  const rawNext = searchParams.get("next") ?? "/home"
  const next =
    rawNext === "/home" || rawNext === "/auth/onboarding" ? rawNext : "/home"

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

      router.replace(next)
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
  }, [login, next, router, toast])

  return <Spinner />
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}
