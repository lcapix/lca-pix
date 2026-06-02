import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, execute } from "@/lib/db-helpers"

/**
 * GET  /api/auth/profile  → return the current user's profile fields.
 * PUT  /api/auth/profile  → update full_name / company / role / use_case /
 *                           country. On the first save we also stamp
 *                           onboarded_at so the onboarding gate stops firing.
 *
 * Required fields on PUT: full_name and company. Everything else is optional.
 */

const ALLOWED_USE_CASES = new Set([
  "product",
  "facility",
  "comparative",
  "research",
  "other",
])

interface AccountRow {
  id: number
  username: string
  email: string
  full_name: string | null
  company: string | null
  role: string | null
  use_case: string | null
  country: string | null
  onboarded_at: string | null
  account_type: string
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const rows = await query<any>(
      `SELECT id, username, email, full_name, company, role, use_case,
              country, onboarded_at, account_type
         FROM account WHERE id = ? LIMIT 1`,
      [userId],
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    const u: AccountRow = rows[0]
    return NextResponse.json({
      success: true,
      profile: {
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.full_name,
        company: u.company,
        role: u.role,
        useCase: u.use_case,
        country: u.country,
        onboardedAt: u.onboarded_at,
        needsOnboarding: !u.onboarded_at || !u.full_name || !u.company,
      },
    })
  } catch (e: any) {
    if (isAuthError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("GET /api/auth/profile failed:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const body = await request.json().catch(() => ({}))

    const fullName = trimOrNull(body.fullName)
    const company = trimOrNull(body.company)
    const role = trimOrNull(body.role)
    const useCase = trimOrNull(body.useCase)
    const country = trimOrNull(body.country)

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 },
      )
    }
    if (!company) {
      return NextResponse.json(
        { error: "Company / organization is required." },
        { status: 400 },
      )
    }
    if (useCase && !ALLOWED_USE_CASES.has(useCase)) {
      return NextResponse.json(
        { error: "Invalid use case." },
        { status: 400 },
      )
    }

    await execute(
      `UPDATE account
          SET full_name = ?, company = ?, role = ?, use_case = ?, country = ?,
              onboarded_at = COALESCE(onboarded_at, NOW())
        WHERE id = ?`,
      [fullName, company, role, useCase, country, userId],
    )

    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (isAuthError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("PUT /api/auth/profile failed:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

function isAuthError(e: any): boolean {
  return (
    e?.message === "Unauthorized" ||
    e?.message === "No authentication token provided" ||
    e?.message === "Invalid or expired token" ||
    e?.message === "User account not found or inactive"
  )
}
