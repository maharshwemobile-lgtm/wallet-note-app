import { NextResponse } from "next/server";
import { z } from "zod";
import { appendRow, getObjectRows } from "@/lib/sheets";
import { getBalances, recordWalletTransaction } from "@/lib/wallet";
import { getUserSettings } from "@/lib/user-settings";
import { requireUserSheet } from "@/lib/user-sheet";

export async function GET() {
  const access = await requireUserSheet();
  if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
  const [rows, settings] = await Promise.all([
    getObjectRows("ExchangeTransactions", access.spreadsheetId),
    getUserSettings(access.spreadsheetId),
  ]);
  return NextResponse.json({ rate: settings.thbToMmkRate, rows: rows.reverse() });
}

export async function POST(req: Request) {
  const access = await requireUserSheet();
  if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
  const parsed = z.object({
    fromCurrency: z.enum(["THB", "MMK"]),
    amount: z.number().positive(),
    customerName: z.string().min(1).max(100),
    note: z.string().max(500).optional(),
  }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  const settings = await getUserSettings(access.spreadsheetId);
  const rate = settings.thbToMmkRate;
  if (rate <= 0) return NextResponse.json({ error: "Set your exchange rate first" }, { status: 400 });
  const toCurrency = parsed.data.fromCurrency === "THB" ? "MMK" : "THB";
  const converted = parsed.data.fromCurrency === "THB" ? parsed.data.amount * rate : parsed.data.amount / rate;
  const balances = await getBalances(access.spreadsheetId);
  if (balances[toCurrency] < converted) return NextResponse.json({ error: `Insufficient ${toCurrency} balance` }, { status: 400 });
  const id = crypto.randomUUID();
  await appendRow("ExchangeTransactions!A:I", [id, new Date().toISOString(), parsed.data.customerName, parsed.data.fromCurrency, parsed.data.amount, toCurrency, converted, rate, parsed.data.note ?? ""], access.spreadsheetId);
  await recordWalletTransaction(access.spreadsheetId, { type: "EXCHANGE_IN", currency: parsed.data.fromCurrency, amount: parsed.data.amount, referenceType: "EXCHANGE", referenceId: id });
  await recordWalletTransaction(access.spreadsheetId, { type: "EXCHANGE_OUT", currency: toCurrency, amount: converted, referenceType: "EXCHANGE", referenceId: id });
  return NextResponse.json({ ok: true, converted });
}
