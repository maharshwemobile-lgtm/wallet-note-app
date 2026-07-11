import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/db";
import { createSession, sessionCookie } from "@/lib/auth";

type UserRow = {
  id: string;
  name: string;
  email: string;
  username: string;
  password_hash: string;
  role: string;
  status: string;
};

export async function POST(req: Request) {
  const parsed = z.object({ identity: z.string().min(1), password: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const identity = parsed.data.identity.trim().toLowerCase();
  const result = await query<UserRow>(
    `SELECT id, name, email, username, password_hash, role, status
     FROM users
     WHERE lower(email) = $1 OR lower(username) = $1
     LIMIT 1`,
    [identity],
  );
  const user = result.rows[0];

  if (!user || !user.password_hash || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return NextResponse.json({ error: "Incorrect email, username or password" }, { status: 401 });
  }
  if (user.status !== "Active") return NextResponse.json({ error: "This account is suspended" }, { status: 403 });

  const token = await createSession({
    userId: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
  });
  const response = NextResponse.json({ ok: true, next: "/dashboard" });
  response.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return response;
}
