"use client"

// Log in (F1.2b): Continue with Google first, then email and password. The
// error sits under the password, in the server's neutral words (it never says
// whether the email has an account). "Forgot password?" is Coming soon: there
// is no reset route yet. A ?error= code from the Google route shows as a card
// above the form, known codes only.

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/store"
import { AuthShell } from "@/components/lcapix/auth/auth-shell"
import { EduAuthShell, EyeIcon, FieldError, GoogleMark } from "@/components/lcapix/auth/edu-auth-shell"
import { ComingSoon, ErrorCard } from "@/components/lcapix/ds"
import { EDU_SHELL } from "@/lib/ui-flags"

type LoginError = { title: string; description: string }

const GENERIC_LOGIN_ERROR: LoginError = {
  title: "Sign-in error",
  description: "Something went wrong while signing in. Please try again.",
}

// Every ?error= code the app sends to this page. Unknown values fall back to
// GENERIC_LOGIN_ERROR and are never displayed.
const LOGIN_ERRORS: Record<string, LoginError> = {
  google_not_configured: {
    title: "Google sign-in not yet configured",
    description: "The Google OAuth keys haven't been set on the server. Use email + password for now.",
  },
  oauth_failed: {
    title: "Google sign-in failed",
    description: "We couldn't complete the Google handshake. Try again or use email + password.",
  },
  google_cancelled: {
    title: "Google sign-in cancelled",
    description: "You cancelled the Google sign-in. Try again whenever you're ready.",
  },
  oauth_state_mismatch: {
    title: "Google sign-in expired",
    description: "That sign-in link expired or was started in another tab. Please try again.",
  },
  userinfo_failed: {
    title: "Google profile lookup failed",
    description: "Google accepted the sign-in but we couldn't read your profile. Try again.",
  },
  google_email_unverified: {
    title: "Google email not verified",
    description: "Your Google account's email address isn't verified. Verify it with Google, or sign up with email and password.",
  },
  account_inactive: {
    title: "Account inactive",
    description: "This account is inactive. Please contact support.",
  },
  server_error: {
    title: "Server error during Google sign-in",
    description: "Something went wrong on our side. Try email + password.",
  },
  oauth_sync_failed: {
    title: "Couldn't finish Google sign-in",
    description: "Session sync failed after the redirect. Try again.",
  },
  session_expired: {
    title: "Session expired",
    description: "Your session expired. Please log in again.",
  },
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [linkError, setLinkError] = useState<LoginError | null>(null)
  const [resetAsked, setResetAsked] = useState(false)
  const router = useRouter()
  const login = useAuthStore((state) => state.login)

  // The Google route and the API client come back here with ?error=<code>.
  // Only known codes are shown; anything else gets the generic words, so a
  // crafted link cannot put its own words on an LCAPIX page. Reading
  // window.location.search keeps the page off useSearchParams (static prerender).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get("error")
    if (!err) return
    setLinkError(Object.prototype.hasOwnProperty.call(LOGIN_ERRORS, err) ? LOGIN_ERRORS[err] : GENERIC_LOGIN_ERROR)
    const url = new URL(window.location.href)
    url.searchParams.delete("error")
    window.history.replaceState({}, "", url.toString())
  }, [])

  const validate = () => {
    const next: typeof errors = {}
    if (!email) next.email = "Enter your email."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter an email like you@company.com."
    if (!password) next.password = "Enter your password."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsLoading(true)
    setErrors({})
    try {
      // A fetch that cannot reach the server rejects with browser-specific text
      // ("Failed to fetch", "NetworkError when ...", "Load failed"); say it plainly.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).catch(() => {
        throw new Error("We could not reach LCAPIX. Check your connection and try again.")
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        setErrors({ password: `${data.error || "Invalid email or password"}. Try again.` })
        return
      }
      if (!response.ok) throw new Error(data.error || "You were not logged in.")
      localStorage.setItem("auth_token", data.token)
      localStorage.setItem("user", JSON.stringify(data.user))
      login({ id: data.user.id.toString(), name: data.user.username, email: data.user.email, createdAt: new Date() })
      router.push("/home")
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : "You were not logged in. Try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const form = (
    <>
      <p className="edu-eyebrow">Welcome back</p>
      <h1 className="edu-h1">Log in</h1>
      <p className="edu-sub">Use the email or Google account you signed up with.</p>
      {linkError && (
        <div style={{ marginBottom: 20 }}>
          <ErrorCard title={linkError.title} cause={linkError.description} />
        </div>
      )}

      <button type="button" className="edu-google" onClick={() => (window.location.href = "/api/auth/google")} disabled={isLoading}>
        <GoogleMark />
        Continue with Google
      </button>
      <div className="edu-or">or with email</div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="edu-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="edu-input"
            type="email"
            autoComplete="email"
            value={email}
            aria-invalid={!!errors.email || undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <FieldError id="email-error">{errors.email}</FieldError>}
        </div>
        <div className="edu-field">
          <span className="edu-field-label" style={{ justifyContent: "space-between" }}>
            <label htmlFor="password">Password</label>
            <button type="button" className="ds-link" aria-expanded={resetAsked} onClick={() => setResetAsked((v) => !v)} style={{ fontWeight: 600 }}>
              Forgot password?
            </button>
          </span>
          <div className="edu-pass">
            <input
              id="password"
              className="edu-input"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              aria-invalid={!!errors.password || undefined}
              aria-describedby={errors.password ? "password-error" : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
              <EyeIcon open={!showPassword} />
            </button>
          </div>
          {errors.password && <FieldError id="password-error">{errors.password}</FieldError>}
          {resetAsked && <ComingSoon>Resetting a password by email is coming soon.</ComingSoon>}
        </div>
        {errors.general && <FieldError id="general-error">{errors.general}</FieldError>}
        <button type="submit" className="edu-submit" disabled={isLoading} aria-busy={isLoading || undefined} style={{ marginTop: 8 }}>
          {isLoading && <span className="ds-spinner" aria-hidden />}
          {isLoading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="edu-foot">
        No account yet?{" "}
        <Link href="/auth/signup" className="ds-link" style={{ fontWeight: 600 }}>
          Create one
        </Link>
      </p>
    </>
  )

  return EDU_SHELL ? <EduAuthShell pane="account">{form}</EduAuthShell> : <AuthShell>{form}</AuthShell>
}
