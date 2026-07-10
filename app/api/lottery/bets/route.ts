import { NextResponse } from "next/server";
import { z } from "zod";
import { appendRow, getObjectRows } from "@/lib/sheets";
import { getBalances, recordWalletTransaction } from "@/lib/wallet";
import { requireUserSheet } from "@/lib/user-sheet";

export async function GET() {
  const access = await requireUserSheet();
  if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
  const rows = await getObjectRows("Bets", access.spreadsheetId);
  return NextResponse.json(rows.reverse());
}

export async function POST(req: Request) {
  const access = await requireUserSheet();
  if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
  const parsed = z.object({
    drawId: z.string().min(1).max(60),
    userId: z.string().min(1).max(80),
    userName: z.string().min(1).max(100),
    number: z.string().regex(/^\d{3}$/),
    amount: z.number().positive(),
    currency: z.enum(["THB", "MMK"]),
  }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Number must be exactly 3 digits" }, { status: 400 });
  const balances = await getBalances(access.spreadsheetId);
  if (balances[parsed.data.currency] < parsed.data.amount) return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
  const id = crypto.randomUUID();
  await appendRow("Bets!A:I", [id, new Date().toISOString(), parsed.data.drawId, parsed.data.userId, parsed.data.userName, parsed.data.number, parsed.data.amount, parsed.data.currency, "OPEN"], access.spreadsheetId);
  await recordWalletTransaction(access.spreadsheetId, { type: "BET", currency: parsed.data.currency, amount: parsed.data.amount, referenceType: "BET", referenceId: id });
  return NextResponse.json({ ok: true });
}
