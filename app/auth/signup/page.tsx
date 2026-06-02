"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import { AuthShell } from "@/components/lcapix/auth/auth-shell"
import { Icon } from "@/components/lcapix/icon"

export default function SignupPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const { toast } = useToast()

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
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long"
    } else if (!/\d/.test(password)) {
      newErrors.password = "Password must contain at least one number"
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
      // Call backend API — derive username from full name if provided, else from email
      const username = fullName.trim() || email.split("@")[0]
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
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
      toast({
        title: "Account created successfully!",
        description: "Just a few quick details and you're in.",
      })
      // Send fresh email signups through the onboarding form so we capture
      // the same profile data Google users provide.
      router.push("/auth/onboarding")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create account. Please try again."
      setErrors({ general: message })
      toast({
        title: "Signup failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Same kill-switch as login. Flip NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED to "true"
  // in Vercel env vars once the redirect URI is whitelisted in Google Cloud Console.
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true"

  const handleGoogleSignup = () => {
    if (!googleEnabled) {
      toast({
        title: "Google sign-up is unavailable",
        description: "We're finalizing the Google OAuth setup. Please use email and password for now.",
      })
      return
    }
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google`
    const scope = "openid email profile"

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`

    window.location.href = googleAuthUrl
  }

  return (
    <AuthShell>
      <h1
        className="display"
        style={{ fontSize: 32, fontWeight: 600, margin: 0, marginBottom: 8, letterSpacing: "-0.01em" }}
      >
        Create your account.
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0, marginBottom: 32 }}>
        Start running LCAs in under a minute.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="label" htmlFor="fullName">
            Name
          </label>
          <input
            id="fullName"
            className="input"
            type="text"
            autoComplete="name"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

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
              autoComplete="new-password"
              placeholder="At least 8 characters"
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
          {errors.password ? (
            <div style={{ fontSize: 12, color: "var(--status-error, #c13b2b)", marginTop: 6 }}>{errors.password}</div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>
              At least 8 characters with one number.
            </div>
          )}
        </div>

        {errors.general ? (
          <div role="alert" style={{ fontSize: 13, color: "var(--status-error, #c13b2b)" }}>
            {errors.general}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="btn btn-primary"
          style={{ height: 44, justifyContent: "center", marginTop: 8 }}
        >
          {isLoading ? "Creating account…" : "Create account"}
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
          onClick={handleGoogleSignup}
          disabled={isLoading}
          aria-disabled={!googleEnabled}
          className="btn btn-secondary"
          style={{
            height: 44,
            justifyContent: "center",
            opacity: googleEnabled ? 1 : 0.55,
            cursor: googleEnabled ? "pointer" : "not-allowed",
            position: "relative",
          }}
          title={
            googleEnabled
              ? "Sign up with your Google account"
              : "Google sign-up is temporarily unavailable — use email/password above"
          }
        >
          <Icon name="google" size={16} /> Continue with Google
          {!googleEnabled && (
            <span
              style={{
                position: "absolute",
                top: -7,
                right: 10,
                fontSize: 9,
                padding: "2px 7px",
                borderRadius: 999,
                background: "var(--surface-overlay)",
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              soon
            </span>
          )}
        </button>
        {!googleEnabled && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-tertiary)",
              textAlign: "center",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Google sign-up is being finalized. Use email + password for now.
          </div>
        )}

        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 16 }}>
          Already have an account?{" "}
          <Link
            href="/auth/login"
            style={{ color: "var(--brand-primary)", textDecoration: "none" }}
          >
            Log in →
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
