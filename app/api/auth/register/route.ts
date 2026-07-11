import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/db";
import { createSession, sessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const parsed = z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/),
    password: z.string().min(8).max(100),
  }).safeParse(await req.json());

  if (!parsed.success) return NextResponse.json({ error: "Please check your registration information" }, { status: 400 });

  const id = crypto.randomUUID();
  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    await query(
      `INSERT INTO users (id, name, email, username, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'user', 'Active')`,
      [id, parsed.data.name.trim(), email, username, passwordHash],
    );
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "23505") return NextResponse.json({ error: "Email or username is already registered" }, { status: 409 });
    throw error;
  }

  const token = await createSession({ userId: id, email, username, name: parsed.data.name.trim(), role: "user" });
  const response = NextResponse.json({ ok: true, next: "/dashboard" });
  response.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return response;
}
