"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import { AuthShell } from "@/components/lcapix/auth/auth-shell"
import { Icon } from "@/components/lcapix/icon"

export default function LoginPage() {
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
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      })
      router.push("/home")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid email or password. Please try again."
      setErrors({ general: message })
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth
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
