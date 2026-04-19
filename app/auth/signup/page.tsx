"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import { AuthLayout } from "@/components/auth/auth-layout"
import { LcapixWordmark } from "@/components/brand/lcapix-wordmark"

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
        description: "Welcome to LCAPIX. You can now start creating projects.",
      })
      router.push("/home")
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

  const handleGoogleSignup = () => {
    // Redirect to Google OAuth (same flow as login - OAuth handles both)
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google`
    const scope = "openid email profile"

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`

    window.location.href = googleAuthUrl
  }

  return (
    <AuthLayout
      rightPane={
        <div className="h-full flex flex-col justify-between px-14 py-16 relative bg-inverse-surface text-inverse-on-surface">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-inverse-on-surface/60">
            Technical Supremacy No. 08
          </div>

          <blockquote className="max-w-xl">
            <p className="text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight">
              Sustainable engineering isn&apos;t a design choice; it&apos;s a{" "}
              <span className="italic veridian-gradient bg-clip-text text-transparent">
                mathematical imperative.
              </span>
            </p>
          </blockquote>

          <div className="flex items-end justify-between max-w-xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-inverse-on-surface/50">
              Veridian Protocol V.4.0
            </div>
            <div className="bg-surface-container-highest/10 border border-inverse-on-surface/10 rounded-lg px-4 py-3 backdrop-blur-sm">
              <div className="font-mono text-[10px] uppercase tracking-wider text-inverse-on-surface/60">
                Avg Core Impact
              </div>
              <div className="num text-2xl font-bold text-primary-fixed-dim">−14.2%</div>
              <div className="text-[11px] text-inverse-on-surface/60">CO₂/kWh</div>
            </div>
          </div>
        </div>
      }
    >
      <LcapixWordmark size="md" subtitle="Sustainability Suite" />

      <h1 className="mt-12 text-3xl font-bold tracking-tight text-on-surface">Get started</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Enter your details to join the Veridian ecosystem.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5">
        <div>
          <Label
            htmlFor="fullName"
            className="font-mono text-xs uppercase tracking-[0.12em] text-on-surface-variant"
          >
            Full Name
          </Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5 border-0 border-b border-outline-variant/40 rounded-none bg-surface-container-low px-3 py-2.5 focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>

        <div>
          <Label
            htmlFor="email"
            className="font-mono text-xs uppercase tracking-[0.12em] text-on-surface-variant"
          >
            Work Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 border-0 border-b border-outline-variant/40 rounded-none bg-surface-container-low px-3 py-2.5 focus-visible:ring-0 focus-visible:border-primary"
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>

        <div>
          <Label
            htmlFor="password"
            className="font-mono text-xs uppercase tracking-[0.12em] text-on-surface-variant"
          >
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 border-0 border-b border-outline-variant/40 rounded-none bg-surface-container-low px-3 py-2.5 pr-10 focus-visible:ring-0 focus-visible:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-1 text-on-surface-variant hover:text-primary"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
          <p className="mt-1.5 text-xs text-on-surface-variant">
            Password must be at least 8 characters with one number
          </p>
        </div>

        {errors.general ? (
          <div className="text-sm text-destructive" role="alert">
            {errors.general}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full veridian-gradient text-white font-semibold py-3 rounded-md shadow-sm hover:opacity-95 disabled:opacity-60 transition-opacity"
        >
          {isLoading ? "Creating account…" : "Create Account →"}
        </button>
      </form>

      <div className="my-8 flex items-center gap-4 text-xs text-on-surface-variant font-mono uppercase tracking-widest">
        <div className="flex-1 h-px bg-outline-variant/30" />
        or continue with
        <div className="flex-1 h-px bg-outline-variant/30" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignup}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 border border-outline-variant/40 rounded-md py-3 font-medium text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-60"
      >
        <GoogleIcon />
        Enterprise Google SSO
      </button>

      <p className="mt-8 text-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-primary font-medium hover:underline">
          Sign in →
        </Link>
      </p>
    </AuthLayout>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 5.04c2.17 0 3.69.94 4.53 1.72l3.31-3.22C17.93 1.53 15.26 0 12 0 7.34 0 3.31 2.7 1.32 6.6l3.85 3c.94-2.8 3.52-4.56 6.83-4.56z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.56-.2-2.3H12v4.36h6.47c-.28 1.51-1.13 2.79-2.4 3.65l3.68 2.87c2.16-2 3.75-4.99 3.75-8.58z"
      />
      <path
        fill="#FBBC05"
        d="M5.17 14.38a7.1 7.1 0 0 1-.37-2.38c0-.83.14-1.63.37-2.38l-3.85-3A11.99 11.99 0 0 0 0 12c0 1.93.46 3.76 1.32 5.38l3.85-3z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.68-2.87c-1.02.69-2.34 1.1-4.27 1.1-3.31 0-6.1-2.24-7.1-5.23l-3.85 3C2.99 21.15 7.03 24 12 24z"
      />
    </svg>
  )
}
