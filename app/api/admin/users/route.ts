import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

function publicLink(token: string) {
  return token ? `${process.env.APP_URL || ""}/bet/${token}` : "";
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const result = await query(
    `SELECT id,name,email,username,role,status,link_token,link_enabled,max_bet_per_number,max_bet_per_draw,created_at FROM users WHERE id=$1 OR owner_id=$1 ORDER BY created_at DESC`,
    [admin.userId],
  );
  return NextResponse.json(result.rows.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    linkToken: user.link_token || "",
    linkEnabled: user.link_enabled,
    bettingLink: publicLink(user.link_token || ""),
    maxBetPerNumber: Number(user.max_bet_per_number || 0),
    maxBetPerDraw: Number(user.max_bet_per_draw || 0),
    createdAt: user.created_at,
  })));
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().email().optional().or(z.literal("")),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/),
    password: z.string().min(8).max(100).optional().or(z.literal("")),
    role: z.enum(["agent", "end_user"]).default("end_user"),
    maxBetPerNumber: z.number().min(0).optional(),
    maxBetPerDraw: z.number().min(0).optional(),
  }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid user" }, { status: 400 });

  const id = crypto.randomUUID();
  const token = parsed.data.role === "end_user" ? crypto.randomUUID().replace(/-/g, "") : null;
  const email = parsed.data.email?.trim().toLowerCase() || `${parsed.data.username.toLowerCase()}@local.wallet-note`;
  const hash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : "";
  await query(
    `INSERT INTO users (id,owner_id,name,email,username,password_hash,role,status,link_token,link_enabled,max_bet_per_number,max_bet_per_draw) VALUES ($1,$2,$3,$4,$5,$6,$7,'Active',$8,true,$9,$10)`,
    [id, admin.userId, parsed.data.name, email, parsed.data.username.toLowerCase(), hash, parsed.data.role, token, parsed.data.maxBetPerNumber || 0, parsed.data.maxBetPerDraw || 0],
  );
  return NextResponse.json({ ok: true, id, linkToken: token, bettingLink: publicLink(token || "") });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({
    userId: z.string().uuid(),
    status: z.enum(["Active", "Suspended"]).optional(),
    role: z.enum(["agent", "end_user"]).optional(),
    linkEnabled: z.boolean().optional(),
    regenerateLink: z.boolean().optional(),
    maxBetPerNumber: z.number().min(0).optional(),
    maxBetPerDraw: z.number().min(0).optional(),
  }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const newToken = parsed.data.regenerateLink ? crypto.randomUUID().replace(/-/g, "") : null;
  const updated = await query(
    `UPDATE users SET
      status=COALESCE($1,status),
      role=COALESCE($2,role),
      link_enabled=COALESCE($3,link_enabled),
      link_token=COALESCE($4,link_token),
      max_bet_per_number=COALESCE($5,max_bet_per_number),
      max_bet_per_draw=COALESCE($6,max_bet_per_draw),
      updated_at=now()
     WHERE id=$7 AND owner_id=$8 RETURNING id,link_token`,
    [parsed.data.status ?? null, parsed.data.role ?? null, parsed.data.linkEnabled ?? null, newToken, parsed.data.maxBetPerNumber ?? null, parsed.data.maxBetPerDraw ?? null, parsed.data.userId, admin.userId],
  );
  if (!updated.rowCount) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ ok: true, bettingLink: publicLink(updated.rows[0].link_token || "") });
}
