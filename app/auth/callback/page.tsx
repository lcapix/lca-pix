"use client"

import { Suspense, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/lib/store"
import { toast } from "sonner"

/**
 * OAuth callback landing page.
 *
 * /api/auth/google finishes the code exchange, leaves the JWT in an httpOnly
 * `auth_token` cookie that lives 2 minutes, and redirects here. This page asks
 * POST /api/auth/google/session for that token once (the response clears the
 * cookie), then promotes it into:
 *   - localStorage.auth_token / localStorage.user — used by lib/api-client for
 *     Authorization headers
 *   - the Zustand auth store (lcapix-auth) — used by AuthGuard to decide if a
 *     route is accessible
 *
 * The token is never readable from document.cookie. Older builds left a
 * JS-readable 7-day `auth_token` and `user_data`; the server clears them in the
 * same response and this page expires any it can see, so revisiting
 * /auth/callback after logout cannot sign the previous user back in.
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
  const ran = useRef(false)

  // Whitelist destination paths to avoid open-redirect attacks via ?next=.
  const rawNext = searchParams.get("next") ?? "/home"
  const next =
    rawNext === "/home" || rawNext === "/auth/onboarding" ? rawNext : "/home"

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const expireLegacyCookies = () => {
      for (const name of ["auth_token", "user_data"]) {
        document.cookie = `${name}=; Max-Age=0; path=/`
      }
    }

    ;(async () => {
      try {
        const res = await fetch("/api/auth/google/session", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        })
        expireLegacyCookies()
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.token || !data?.user) {
          throw new Error("Could not finish Google sign-in. Try signing in again.")
        }

        const { token, user } = data as {
          token: string
          user: { id: number | string; username: string; email: string }
        }

        localStorage.setItem("auth_token", token)
        localStorage.setItem(
          "user",
          JSON.stringify({ id: user.id, username: user.username, email: user.email })
        )

        login({
          id: String(user.id),
          name: user.username,
          email: user.email,
          createdAt: new Date(),
        })

        toast.success("Welcome!", { description: "Signed in with Google." })

        router.replace(next)
      } catch (err) {
        expireLegacyCookies()
        const message =
          err instanceof Error ? err.message : "OAuth sign-in failed."
        toast.error("Sign-in failed", { description: message })
        router.replace("/auth/login?error=oauth_sync_failed")
      }
    })()
  }, [login, next, router])

  return <Spinner />
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}
