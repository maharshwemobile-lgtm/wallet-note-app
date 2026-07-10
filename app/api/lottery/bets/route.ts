import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { appendRow, getObjectRows } from "@/lib/sheets";
import { getBalances, recordWalletTransaction } from "@/lib/wallet";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await getObjectRows("Bets");
  return NextResponse.json(rows.filter((row) => row.userId === session.userId).reverse());
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = z.object({
    drawId: z.string().min(1).max(60),
    userId: z.string().min(1).max(80),
    userName: z.string().min(1).max(100),
    number: z.string().regex(/^\d{3}$/),
    amount: z.number().positive(),
    currency: z.enum(["THB", "MMK"]),
  }).safeParse(await req.json());

  if (!parsed.success) return NextResponse.json({ error: "Number must be exactly 3 digits" }, { status: 400 });

  const balances = await getBalances(session.userId);
  if (balances[parsed.data.currency] < parsed.data.amount) {
    return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await appendRow("Bets!A:K", [
    id,
    session.userId,
    new Date().toISOString(),
    parsed.data.drawId,
    parsed.data.userId,
    parsed.data.userName,
    parsed.data.number,
    parsed.data.amount,
    parsed.data.currency,
    "OPEN",
  ]);

  await recordWalletTransaction({
    userId: session.userId,
    type: "BET",
    currency: parsed.data.currency,
    amount: parsed.data.amount,
    referenceType: "BET",
    referenceId: id,
  });

  return NextResponse.json({ ok: true });
}
