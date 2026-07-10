import { NextResponse } from "next/server";
import { getBalances } from "@/lib/wallet";
import { getObjectRows } from "@/lib/sheets";
import { getUserSettings } from "@/lib/user-settings";
import { requireUserSheet } from "@/lib/user-sheet";

export async function GET() {
  const access = await requireUserSheet();
  if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
  const { session, spreadsheetId } = access;
  const [balances, wallet, bets, settings] = await Promise.all([
    getBalances(spreadsheetId),
    getObjectRows("WalletTransactions", spreadsheetId),
    getObjectRows("Bets", spreadsheetId),
    getUserSettings(spreadsheetId),
  ]);
  return NextResponse.json({
    user: session,
    balances,
    rate: settings.thbToMmkRate,
    recent: wallet.slice(-8).reverse(),
    totalBets: bets.length,
  });
}
