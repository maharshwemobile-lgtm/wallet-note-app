import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { appendRow, getObjectRows } from "@/lib/sheets";
import { createSession, sessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const parsed = z.object({ name: z.string().min(2).max(80), email: z.string().email(), username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/), password: z.string().min(8).max(100) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check your registration information" }, { status: 400 });
  const users = await getObjectRows("Users");
  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim().toLowerCase();
  if (users.some(u => u.email?.toLowerCase() === email)) return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
  if (users.some(u => u.username?.toLowerCase() === username)) return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await appendRow("Users!A:H", [id, parsed.data.name.trim(), email, username, passwordHash, "user", "Active", new Date().toISOString()]);
  await appendRow("UserSettings!A:C", [id, 0, 500]);
  const token = await createSession({ userId: id, email, username, name: parsed.data.name.trim(), role: "user" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return res;
}
