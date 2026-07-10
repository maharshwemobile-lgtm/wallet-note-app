import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getBalances } from "@/lib/wallet";
import { getObjectRows, getSetting } from "@/lib/sheets";
export async function GET() {
  const s = await readSession(); if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [balances, wallet, bets, rate] = await Promise.all([getBalances(s.agentId), getObjectRows("WalletTransactions"), getObjectRows("Bets"), getSetting("THB_TO_MMK", "0")]);
  const recent = wallet.filter(r => r.agentId === s.agentId).slice(-8).reverse();
  return NextResponse.json({ agent: s, balances, rate: Number(rate), recent, totalBets: bets.filter(b => b.agentId === s.agentId).length });
}
