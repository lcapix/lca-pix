"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/store"
import { toast } from "sonner"
import { AuthShell } from "@/components/lcapix/auth/auth-shell"
import { Icon } from "@/components/lcapix/icon"

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

  const router = useRouter()
  const login = useAuthStore((state) => state.login)

  // Surface sign-in errors as toasts. The Google route and the API client
  // bounce here with ?error=<code>. Only known codes are shown; anything else
  // gets a generic message, so a crafted link cannot put its own words in an
  // app-branded toast. Reading window.location.search (instead of
  // useSearchParams) avoids forcing the page off Next.js's static prerender path.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const err = params.get("error")
    if (!err) return
    const msg = Object.prototype.hasOwnProperty.call(LOGIN_ERRORS, err)
      ? LOGIN_ERRORS[err]
      : GENERIC_LOGIN_ERROR
    toast.error(msg.title, { description: msg.description })
    // Strip the param so reloads don't re-toast.
    const url = new URL(window.location.href)
    url.searchParams.delete("error")
    window.history.replaceState({}, "", url.toString())
  }, [])

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) {
      newErrors.email = "Email is required"
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address"
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      // Call backend API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      // Store token and user data
      localStorage.setItem("auth_token", data.token)
      localStorage.setItem("user", JSON.stringify(data.user))

      // Update auth store
      const user = {
        id: data.user.id.toString(),
        name: data.user.username,
        email: data.user.email,
        createdAt: new Date(),
      }

      login(user)
      toast.success("Welcome back!", {
        description: "You have successfully logged in.",
      })
      router.push("/home")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid email or password. Please try again."
      setErrors({ general: message })
      toast.error("Login failed", { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  // Google sign-in: always live in the UI. Navigate to the server route, which
  // owns the OAuth URL construction and will redirect to a friendly error toast
  // here if env vars are missing on the server (see /api/auth/google).
  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google"
  }

  return (
    <AuthShell>
      <h1
        className="display"
        style={{ fontSize: 32, fontWeight: 600, margin: 0, marginBottom: 8, letterSpacing: "-0.01em" }}
      >
        Welcome back.
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0, marginBottom: 32 }}>
        Sign in to continue your assessments.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && (
            <div style={{ fontSize: 12, color: "var(--status-error, #c13b2b)", marginTop: 6 }}>{errors.email}</div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="password"
              className="input"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                padding: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="eye" size={16} />
            </button>
          </div>
          {errors.password && (
            <div style={{ fontSize: 12, color: "var(--status-error, #c13b2b)", marginTop: 6 }}>{errors.password}</div>
          )}
        </div>

        {errors.general ? (
          <div role="alert" style={{ fontSize: 13, color: "var(--status-error, #c13b2b)" }}>
            {errors.general}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary"
          style={{ height: 44, justifyContent: "center", marginTop: 8 }}
        >
          {isLoading ? "Signing in…" : "Log in"}
        </button>

        <div
          className="divider-tonal"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "8px 0",
            color: "var(--text-tertiary)",
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          <span>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="btn btn-secondary"
          style={{ height: 44, justifyContent: "center" }}
          title="Sign in with your Google account"
        >
          <Icon name="google" size={16} /> Continue with Google
        </button>

        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 16 }}>
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            style={{ color: "var(--brand-primary)", textDecoration: "none" }}
          >
            Sign up →
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
