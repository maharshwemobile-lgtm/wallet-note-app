import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSession, sessionCookie } from "@/lib/auth";

const OAUTH_STATE_COOKIE = "wallet_note_oauth_state";

type UserRow = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  status: string;
};

function appOrigin(req: NextRequest) {
  return (process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, "");
}

async function safeUsername(email: string) {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 24) || "googleuser";
  const existing = await query<{ username: string }>(`SELECT username FROM users WHERE username LIKE $1`, [`${base}%`]);
  const names = new Set(existing.rows.map((row) => row.username.toLowerCase()));
  if (!names.has(base)) return base;
  for (let index = 2; index < 10000; index += 1) {
    const suffix = String(index);
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    if (!names.has(candidate)) return candidate;
  }
  return `google-${crypto.randomUUID().slice(0, 8)}`;
}

function loginError(req: NextRequest, message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, appOrigin(req)));
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const savedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
    if (!code || !state || !savedState || state !== savedState) return loginError(req, "Google login verification failed");

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return loginError(req, "Google login is not configured");

    const redirectUri = `${appOrigin(req)}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const profile = await oauth2.userinfo.get();
    const email = profile.data.email?.trim().toLowerCase();
    const name = profile.data.name?.trim() || email?.split("@")[0] || "Google User";
    if (!email || profile.data.verified_email !== true) return loginError(req, "A verified Google email is required");

    const found = await query<UserRow>(`SELECT id,name,email,username,role,status FROM users WHERE lower(email)=$1 LIMIT 1`, [email]);
    let user = found.rows[0];
    if (!user) {
      const id = crypto.randomUUID();
      const username = await safeUsername(email);
      const created = await query<UserRow>(
        `INSERT INTO users (id,name,email,username,password_hash,role,status) VALUES ($1,$2,$3,$4,'','user','Active') RETURNING id,name,email,username,role,status`,
        [id, name, email, username],
      );
      user = created.rows[0];
    }
    if (user.status !== "Active") return loginError(req, "This account is suspended");

    const token = await createSession({ userId: user.id, email: user.email, username: user.username, name: user.name, role: user.role });
    const response = NextResponse.redirect(new URL("/dashboard", appOrigin(req)));
    response.cookies.set(sessionCookie.name, token, sessionCookie.options);
    response.cookies.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return loginError(req, "Google login failed. Please try again");
  }
}
