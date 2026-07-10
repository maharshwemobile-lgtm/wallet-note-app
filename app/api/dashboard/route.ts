import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getBalances } from "@/lib/wallet";
import { getObjectRows } from "@/lib/sheets";
import { getUserSettings } from "@/lib/user-settings";
export async function GET() {
  const s = await readSession(); if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [balances, wallet, bets, settings] = await Promise.all([getBalances(s.userId), getObjectRows("WalletTransactions"), getObjectRows("Bets"), getUserSettings(s.userId)]);
  const recent = wallet.filter(r => r.userId === s.userId).slice(-8).reverse();
  return NextResponse.json({ user: s, balances, rate: settings.thbToMmkRate, recent, totalBets: bets.filter(b => b.userId === s.userId).length });
}
