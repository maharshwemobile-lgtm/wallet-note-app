import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";

const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

function cycleKey(type: string, date: string) {
  if (type === "3D") {
    const d = new Date(`${date}T00:00:00Z`);
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - day + 1);
    return `${d.toISOString().slice(0, 10)}-week`;
  }
  return date;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await query(
    `SELECT id, owner_id, name, status, link_enabled, max_bet_per_number, max_bet_per_draw FROM users WHERE link_token=$1 AND role='end_user' LIMIT 1`,
    [token],
  );
  const row = user.rows[0];
  if (!row || row.status !== "Active" || !row.link_enabled || !row.owner_id) return NextResponse.json({ error: "Betting link is disabled" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    customer: { id: row.id, name: row.name, maxBetPerNumber: num(row.max_bet_per_number), maxBetPerDraw: num(row.max_bet_per_draw) },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const link = await query(
      `SELECT id, owner_id, name, status, link_enabled, max_bet_per_number, max_bet_per_draw FROM users WHERE link_token=$1 AND role='end_user' LIMIT 1`,
      [token],
    );
    const user = link.rows[0];
    if (!user || user.status !== "Active" || !user.link_enabled || !user.owner_id) return NextResponse.json({ error: "Betting link is disabled" }, { status: 404 });

    const parsed = z.object({
      date: z.string().min(1),
      type: z.enum(["2D", "3D", "Other"]),
      currency: z.enum(["MMK", "THB"]),
      number: z.string().trim().min(1).max(20),
      betAmount: z.number().positive(),
      payoutMultiplier: z.number().positive().default(80),
      note: z.string().trim().max(300).optional(),
    }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid bet" }, { status: 400 });

    const digits = parsed.data.number.replace(/\D/g, "");
    if ((parsed.data.type === "2D" && digits.length !== 2) || (parsed.data.type === "3D" && digits.length !== 3)) return NextResponse.json({ error: `${parsed.data.type} number is invalid` }, { status: 400 });
    if (num(user.max_bet_per_number) > 0 && parsed.data.betAmount > num(user.max_bet_per_number)) return NextResponse.json({ error: "Amount exceeds per-number limit" }, { status: 400 });

    const total = await query(
      `SELECT COALESCE(SUM(bet_amount),0) total FROM lottery_entries WHERE user_id=$1 AND source_end_user_id=$2 AND draw_date=$3 AND lottery_type=$4 AND currency=$5 AND deleted_at IS NULL`,
      [user.owner_id, user.id, parsed.data.date, parsed.data.type, parsed.data.currency],
    );
    if (num(user.max_bet_per_draw) > 0 && num(total.rows[0].total) + parsed.data.betAmount > num(user.max_bet_per_draw)) return NextResponse.json({ error: "Amount exceeds draw limit" }, { status: 400 });

    const id = crypto.randomUUID();
    await query(
      `INSERT INTO lottery_entries (id,user_id,source_end_user_id,draw_date,cycle_key,lottery_type,currency,number,customer_name,bet_amount,payout_multiplier,payment_status,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'debt',$12)`,
      [id, user.owner_id, user.id, parsed.data.date, cycleKey(parsed.data.type, parsed.data.date), parsed.data.type, parsed.data.currency, parsed.data.number, user.name, parsed.data.betAmount, parsed.data.payoutMultiplier, parsed.data.note || "End user betting link"],
    );
    return NextResponse.json({ ok: true, id, message: "Bet submitted" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bet failed" }, { status: 500 });
  }
}
