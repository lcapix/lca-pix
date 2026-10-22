"use client"

// Sign-up (F1.2): Continue with Google first, then name, email and password,
// the Terms line, and that team workspaces are in development. Errors sit on
// the line they belong to, never in a toast; the server's wording is neutral
// (it never says whether an email has an account). Then About you.

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/store"
import { AuthShell } from "@/components/lcapix/auth/auth-shell"
import { EduAuthShell, EyeIcon, FieldError, GoogleMark } from "@/components/lcapix/auth/edu-auth-shell"
import { EDU_SHELL } from "@/lib/ui-flags"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignupPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string; duplicate?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const login = useAuthStore((state) => state.login)

  const validate = () => {
    const next: typeof errors = {}
    if (!email) next.email = "Enter your email."
    else if (!EMAIL_RE.test(email)) next.email = "Enter an email like you@university.edu."
    if (!password) next.password = "Enter a password."
    else if (password.length < 8) next.password = "Use at least 8 characters."
    else if (!/\d/.test(password)) next.password = "Add at least one number."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsLoading(true)
    setErrors({})
    try {
      // The server derives a unique username from the email; the name typed
      // here is the person's full name.
      // A fetch that cannot reach the server rejects with browser-specific text
      // ("Failed to fetch", "NetworkError when ...", "Load failed"); say it plainly.
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), email, password }),
      }).catch(() => {
        throw new Error("We could not reach LCAPIX. Check your connection and try again.")
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 409) {
        setErrors({ duplicate: data.error || "We could not create an account with those details." })
        return
      }
      if (!response.ok) throw new Error(data.error || "The account was not created.")
      localStorage.setItem("auth_token", data.token)
      localStorage.setItem("user", JSON.stringify(data.user))
      login({
        id: data.user.id.toString(),
        name: fullName.trim() || data.user.username,
        email: data.user.email,
        createdAt: new Date(),
      })
      // Every new account goes through About you, as Google sign-ups do.
      router.push("/auth/onboarding")
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : "The account was not created. Try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const form = (
    <>
      <p className="edu-eyebrow">Teaching and research</p>
      <h1 className="edu-h1">Create your account</h1>
      <p className="edu-sub">For professors, instructors and researchers. Email or Google.</p>

      {/* The first Tab stop (acceptance check 10). The server route owns the OAuth handshake. */}
      <button type="button" className="edu-google" onClick={() => (window.location.href = "/api/auth/google")} disabled={isLoading}>
        <GoogleMark />
        Continue with Google
      </button>
      <div className="edu-or">or with email</div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="edu-field">
          <label htmlFor="fullName">Your name</label>
          <input id="fullName" className="edu-input" type="text" autoComplete="name" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="edu-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="edu-input"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            aria-invalid={!!(errors.email || errors.duplicate) || undefined}
            aria-describedby={errors.email ? "email-error" : errors.duplicate ? "duplicate-error" : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <FieldError id="email-error">{errors.email}</FieldError>}
          {errors.duplicate && (
            <FieldError id="duplicate-error">
              {errors.duplicate}{" "}
              <Link href="/auth/login" className="ds-link">
                Log in instead.
              </Link>
            </FieldError>
          )}
        </div>
        <div className="edu-field">
          <label htmlFor="password">Password</label>
          <div className="edu-pass">
            <input
              id="password"
              className="edu-input"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              aria-invalid={!!errors.password || undefined}
              aria-describedby={errors.password ? "password-error" : "password-hint"}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
              <EyeIcon open={!showPassword} />
            </button>
          </div>
          {errors.password ? (
            <FieldError id="password-error">{errors.password}</FieldError>
          ) : (
            <span id="password-hint" className="edu-hint">
              At least 8 characters with one number.
            </span>
          )}
        </div>
        {errors.general && <FieldError id="general-error">{errors.general}</FieldError>}
        <button type="submit" className="edu-submit" disabled={isLoading} aria-busy={isLoading || undefined} style={{ marginTop: 8 }}>
          {isLoading && <span className="ds-spinner" aria-hidden />}
          {isLoading ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <p className="edu-foot" style={{ fontSize: 14 }}>
        By creating an account you agree to the{" "}
        <Link href="/legal/terms" className="ds-link">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="ds-link">
          Privacy
        </Link>
      </p>
      <p className="edu-foot">
        Already have an account?{" "}
        <Link href="/auth/login" className="ds-link" style={{ fontWeight: 600 }}>
          Log in
        </Link>
      </p>
      <p className="edu-note">The same account works for your own studies. Team and company workspaces are in development.</p>
    </>
  )

  return EDU_SHELL ? <EduAuthShell pane="account">{form}</EduAuthShell> : <AuthShell>{form}</AuthShell>
}
