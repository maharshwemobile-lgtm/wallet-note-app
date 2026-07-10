import { randomBytes } from "crypto";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const OAUTH_STATE_COOKIE = "wallet_note_oauth_state";

function appOrigin(req: NextRequest) {
  return (process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=Google+login+is+not+configured", appOrigin(req)),
    );
  }

  const redirectUri = `${appOrigin(req)}/api/auth/google/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const state = randomBytes(32).toString("hex");

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
