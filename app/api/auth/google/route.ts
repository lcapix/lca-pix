import { NextRequest, NextResponse } from "next/server"
import { createToken } from "@/lib/auth"
import { query } from "@/lib/db-helpers"
import bcrypt from "bcrypt"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!code) {
      // No authorization code - redirect to Google OAuth consent screen
      const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleAuthUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!);
      googleAuthUrl.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google`);
      googleAuthUrl.searchParams.set("response_type", "code");
      googleAuthUrl.searchParams.set("scope", "openid email profile");
      googleAuthUrl.searchParams.set("access_type", "offline");
      googleAuthUrl.searchParams.set("prompt", "consent");
      return NextResponse.redirect(googleAuthUrl.toString());
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google`,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error("Google token exchange failed:", errorData)
      return NextResponse.redirect(
        new URL("/auth/login?error=oauth_failed", request.url)
      )
    }

    const tokens = await tokenResponse.json()

    // Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      console.error("Failed to fetch Google user info")
      return NextResponse.redirect(
        new URL("/auth/login?error=userinfo_failed", request.url)
      )
    }

    const googleUser = await userInfoResponse.json()

    // Check if user exists in database
    const existingUsers = await query("SELECT * FROM account WHERE email = ?", [
      googleUser.email,
    ])

    let user

    if (existingUsers.length > 0) {
      // User exists, log them in
      user = existingUsers[0]
    } else {
      // Create new user
      const username = googleUser.email.split("@")[0]

      // Generate a random password hash (won't be used for OAuth users, but required by schema)
      const randomPassword = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(randomPassword, 10)

      const result = await query(
        "INSERT INTO account (username, email, password_hash, account_type, is_active) VALUES (?, ?, ?, 'user', TRUE)",
        [username, googleUser.email, hashedPassword]
      )

      // Fetch the newly created user
      const newUsers = await query("SELECT * FROM account WHERE id = ?", [
        (result as any).insertId,
      ])
      user = newUsers[0]
    }

    // Generate JWT token
    const token = createToken({
      id: user.id,
      email: user.email,
      account_type: user.account_type,
    })

    // Redirect to a client-side callback page that syncs cookies into
    // localStorage + Zustand auth store (which AuthGuard reads). Without this
    // step, /home mounts with isAuthenticated=false and bounces to /auth/login.
    const response = NextResponse.redirect(new URL("/auth/callback", request.url))

    // auth_token is readable from JS so the existing api-client (which reads
    // localStorage.auth_token for the Authorization header) keeps working.
    // This mirrors the email-login flow, which also keeps the token in
    // localStorage. The trade-off vs httpOnly: XSS exposure — acceptable here
    // because the email-login flow already does the same.
    response.cookies.set("auth_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    response.cookies.set(
      "user_data",
      JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
      }),
      {
        httpOnly: false, // Accessible from client-side
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      }
    )

    return response
  } catch (error) {
    console.error("Google OAuth error:", error)
    return NextResponse.redirect(
      new URL("/auth/login?error=server_error", request.url)
    )
  }
}
