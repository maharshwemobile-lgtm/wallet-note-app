import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getObjectRows } from "./sheets";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "change-me");
const COOKIE_NAME = "wallet_note_session";

export type SessionUser = { userId: string; email: string; username: string; name: string; role: string };

export async function createSession(payload: SessionUser) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret);
}

export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = (await jwtVerify(token, secret)).payload as unknown as SessionUser;
    const users = await getObjectRows("Users");
    const user = users.find(u => u.id === payload.userId);
    if (!user || user.status !== "Active") return null;
    return { userId: user.id, email: user.email, username: user.username, name: user.name, role: user.role };
  } catch { return null; }
}

export async function requireAdmin() {
  const session = await readSession();
  return session?.role === "admin" ? session : null;
}

export const sessionCookie = { name: COOKIE_NAME, options: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 } };
