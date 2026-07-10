import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getObjectRows, readRows, updateRange } from "@/lib/sheets";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const users = await getObjectRows("Users");
  return NextResponse.json(users.map(({ passwordHash, ...user }) => user));
}

export async function PATCH(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ userId: z.string().uuid(), status: z.enum(["Active", "Suspended"]) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const rows = await readRows("Users!A:H");
  const index = rows.findIndex((r, i) => i > 0 && r[0] === parsed.data.userId);
  if (index < 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
  await updateRange(`Users!G${index + 1}`, [[parsed.data.status]]);
  return NextResponse.json({ ok: true });
}
