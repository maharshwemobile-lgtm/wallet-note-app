import { NextResponse } from "next/server";
import { z } from "zod";
import { getBalances, recordWalletTransaction } from "@/lib/wallet";
import { getObjectRows } from "@/lib/sheets";
import { requireUserSheet } from "@/lib/user-sheet";

export async function GET() {
  const access = await requireUserSheet();
  if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
  const [balances, rows] = await Promise.all([
    getBalances(access.spreadsheetId),
    getObjectRows("WalletTransactions", access.spreadsheetId),
  ]);
  return NextResponse.json({ balances, rows: rows.reverse() });
}

export async function POST(req: Request) {
  const access = await requireUserSheet();
  if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
  const parsed = z.object({
    type: z.enum(["CASH_IN", "CASH_OUT"]),
    currency: z.enum(["THB", "MMK"]),
    amount: z.number().positive(),
    note: z.string().max(500).optional(),
  }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  await recordWalletTransaction(access.spreadsheetId, { ...parsed.data, status: "Pending" });
  return NextResponse.json({ ok: true });
}
