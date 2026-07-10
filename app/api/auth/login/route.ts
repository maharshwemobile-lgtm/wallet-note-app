import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getObjectRows } from "@/lib/sheets";
import { createSession, sessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const parsed = z.object({ username: z.string().min(1), password: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const agents = await getObjectRows("Agents");
  const agent = agents.find(a => a.username === parsed.data.username && a.active !== "FALSE");
  if (!agent || !(await bcrypt.compare(parsed.data.password, agent.passwordHash))) return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  const token = await createSession({ agentId: agent.id, username: agent.username, name: agent.name, role: agent.role });
  const res = NextResponse.json({ ok: true }); res.cookies.set(sessionCookie.name, token, sessionCookie.options); return res;
}
