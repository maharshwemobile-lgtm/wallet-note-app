import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { appendRow, getObjectRows } from "@/lib/sheets";
import { getUserSettings } from "@/lib/user-settings";
import { recordWalletTransaction } from "@/lib/wallet";

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const drawId = new URL(req.url).searchParams.get("drawId") ?? "";
  const [bets, results, settings] = await Promise.all([
    getObjectRows("Bets"),
    getObjectRows("LotteryResults"),
    getUserSettings(session.userId),
  ]);
  const result = results.find((row) => row.userId === session.userId && row.drawId === drawId);
  const winners = result
    ? bets
        .filter((bet) => bet.userId === session.userId && bet.drawId === drawId && bet.number === result.winningNumber)
        .map((bet) => ({ ...bet, payout: Number(bet.amount) * settings.payoutMultiplier }))
    : [];

  return NextResponse.json({ result, winners, multiplier: settings.payoutMultiplier });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = z.object({
    drawId: z.string().min(1).max(60),
    winningNumber: z.string().regex(/^\d{3}$/),
    source: z.enum(["MANUAL", "API"]).default("MANUAL"),
  }).safeParse(await req.json());

  if (!parsed.success) return NextResponse.json({ error: "Invalid result" }, { status: 400 });

  const results = await getObjectRows("LotteryResults");
  if (results.some((row) => row.userId === session.userId && row.drawId === parsed.data.drawId)) {
    return NextResponse.json({ error: "Result already exists for this draw" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await appendRow("LotteryResults!A:F", [
    id,
    session.userId,
    new Date().toISOString(),
    parsed.data.drawId,
    parsed.data.winningNumber,
    parsed.data.source,
  ]);

  const [bets, settings] = await Promise.all([
    getObjectRows("Bets"),
    getUserSettings(session.userId),
  ]);
  const winners = bets.filter(
    (bet) => bet.userId === session.userId && bet.drawId === parsed.data.drawId && bet.number === parsed.data.winningNumber,
  );

  for (const winner of winners) {
    await recordWalletTransaction({
      userId: session.userId,
      type: "PAYOUT",
      currency: winner.currency as "THB" | "MMK",
      amount: Number(winner.amount) * settings.payoutMultiplier,
      referenceType: "LOTTERY_RESULT",
      referenceId: id,
    });
  }

  return NextResponse.json({ ok: true, winners: winners.length });
}

export async function fetchWinningNumberFromProvider(drawId: string) {
  const endpoint = process.env.LOTTERY_API_URL;
  if (!endpoint) throw new Error("LOTTERY_API_URL is not configured");
  const response = await fetch(`${endpoint}?drawId=${encodeURIComponent(drawId)}`, {
    headers: { Authorization: `Bearer ${process.env.LOTTERY_API_KEY ?? ""}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Lottery provider request failed");
  const data = await response.json();
  return String(data.winningNumber).padStart(3, "0");
}
