import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getObjectRows } from "@/lib/sheets";
import { createSession, sessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const parsed = z.object({ identity: z.string().min(1), password: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const identity = parsed.data.identity.trim().toLowerCase();
  const users = await getObjectRows("Users");
  const user = users.find(u => u.email?.toLowerCase() === identity || u.username?.toLowerCase() === identity);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return NextResponse.json({ error: "Incorrect email, username or password" }, { status: 401 });
  if (user.status !== "Active") return NextResponse.json({ error: "This account is suspended" }, { status: 403 });
  const token = await createSession({ userId: user.id, email: user.email, username: user.username, name: user.name, role: user.role });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return res;
}
