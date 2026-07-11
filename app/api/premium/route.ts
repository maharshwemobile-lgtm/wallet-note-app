import { NextResponse } from "next/server";
import { z } from "zod";
import { query, transaction } from "@/lib/db";
import { readSession } from "@/lib/auth";

const currency = z.enum(["MMK", "THB"]);
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

async function requireUser() {
  const session = await readSession();
  if (!session) return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.userId;
    const [walletResult, remittanceResult, debtResult, lotteryResult, resultResult, ledgerResult] = await Promise.all([
      query(`SELECT id, name, currency, initial_balance, status, created_at FROM wallets WHERE user_id=$1 AND status <> 'Deleted' ORDER BY created_at DESC`, [userId]),
      query(`SELECT id, tx_date, action, mode, source_wallet_id, target_wallet_id, source_amount, rate, target_amount, customer_name, note, status, created_at FROM remittances WHERE user_id=$1 AND status <> 'Deleted' ORDER BY tx_date DESC, created_at DESC`, [userId]),
      query(`SELECT id, tx_date, debt_type, name, currency, amount, wallet_id, note, status, created_at FROM debts WHERE user_id=$1 AND status <> 'Deleted' ORDER BY tx_date DESC, created_at DESC`, [userId]),
      query(`SELECT id, draw_date, lottery_type, currency, number, customer_name, bet_amount, payout_multiplier, note, dealer_status, dealer_wallet_id, dealer_settled_at, result_status, payout_amount, created_at FROM lottery_entries WHERE user_id=$1 AND deleted_at IS NULL ORDER BY draw_date DESC, created_at DESC`, [userId]),
      query(`SELECT id, draw_date, lottery_type, currency, winning_number, created_at FROM lottery_results WHERE user_id=$1 ORDER BY draw_date DESC, created_at DESC`, [userId]),
      query(`SELECT wallet_id, COALESCE(SUM(amount),0) total FROM wallet_ledger WHERE user_id=$1 GROUP BY wallet_id`, [userId]),
    ]);

    const wallets = walletResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      currency: row.currency,
      initialBalance: num(row.initial_balance),
      balance: num(row.initial_balance),
      status: row.status,
      createdAt: row.created_at,
    }));
    const balanceMap = new Map(wallets.map((wallet) => [wallet.id, wallet.balance]));

    for (const row of remittanceResult.rows) {
      if (balanceMap.has(row.source_wallet_id)) balanceMap.set(row.source_wallet_id, num(balanceMap.get(row.source_wallet_id)) - num(row.source_amount));
      if (balanceMap.has(row.target_wallet_id)) balanceMap.set(row.target_wallet_id, num(balanceMap.get(row.target_wallet_id)) + num(row.target_amount));
    }
    for (const row of debtResult.rows) {
      if (row.status !== "paid" || !row.wallet_id || !balanceMap.has(row.wallet_id)) continue;
      balanceMap.set(row.wallet_id, num(balanceMap.get(row.wallet_id)) + (row.debt_type === "receivable" ? num(row.amount) : -num(row.amount)));
    }
    for (const row of ledgerResult.rows) {
      if (balanceMap.has(row.wallet_id)) balanceMap.set(row.wallet_id, num(balanceMap.get(row.wallet_id)) + num(row.total));
    }
    for (const wallet of wallets) wallet.balance = num(balanceMap.get(wallet.id));

    const remittances = remittanceResult.rows.map((row) => ({
      id: row.id, date: row.tx_date, action: row.action, mode: row.mode,
      sourceWalletId: row.source_wallet_id, targetWalletId: row.target_wallet_id,
      sourceAmount: num(row.source_amount), rate: num(row.rate), targetAmount: num(row.target_amount),
      customerName: row.customer_name, note: row.note, status: row.status, createdAt: row.created_at,
    }));
    const debts = debtResult.rows.map((row) => ({
      id: row.id, date: row.tx_date, type: row.debt_type, name: row.name, currency: row.currency,
      amount: num(row.amount), walletId: row.wallet_id || "", note: row.note, status: row.status, createdAt: row.created_at,
    }));
    const lotteries = lotteryResult.rows.map((row) => ({
      id: row.id, date: row.draw_date, type: row.lottery_type, currency: row.currency, number: row.number,
      customerName: row.customer_name, betAmount: num(row.bet_amount), payoutMultiplier: num(row.payout_multiplier),
      note: row.note, status: row.dealer_status, dealerWalletId: row.dealer_wallet_id || "",
      dealerSettledAt: row.dealer_settled_at || "", resultStatus: row.result_status,
      payoutAmount: num(row.payout_amount), createdAt: row.created_at,
    }));
    const results = resultResult.rows.map((row) => ({
      id: row.id, date: row.draw_date, type: row.lottery_type, currency: row.currency,
      winningNumber: row.winning_number, createdAt: row.created_at,
    }));

    const debtSummary = { receivable: { MMK: 0, THB: 0 }, payable: { MMK: 0, THB: 0 } };
    for (const row of debts) if (row.status === "unpaid") debtSummary[row.type === "payable" ? "payable" : "receivable"][row.currency === "THB" ? "THB" : "MMK"] += row.amount;

    const lotterySummary = { total: { MMK: 0, THB: 0 }, pending: { MMK: 0, THB: 0 }, settled: { MMK: 0, THB: 0 }, winning: { MMK: 0, THB: 0 } };
    for (const row of lotteries) {
      const curr = row.currency === "THB" ? "THB" : "MMK";
      lotterySummary.total[curr] += row.betAmount;
      lotterySummary[row.status === "settled" ? "settled" : "pending"][curr] += row.betAmount;
      if (row.resultStatus === "won") lotterySummary.winning[curr] += row.payoutAmount;
    }

    const winners = lotteries.filter((row) => row.resultStatus === "won");
    return NextResponse.json({
      storage: { provider: "PostgreSQL", connected: true, spreadsheetTitle: "PostgreSQL Main Database" },
      wallets, remittances, debts, lotteries, results, winners, debtSummary, lotterySummary,
    });
  } catch (error) {
    console.error("Premium GET", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database read failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const entity = z.enum(["wallet", "remittance", "debt", "lottery", "lotteryResult"]).safeParse(body.entity);
    if (!entity.success) return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    const id = crypto.randomUUID();

    if (entity.data === "wallet") {
      const parsed = z.object({ name: z.string().trim().min(1).max(80), currency, initialBalance: z.number().min(0) }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid wallet data" }, { status: 400 });
      await query(`INSERT INTO wallets (id,user_id,name,currency,initial_balance) VALUES ($1,$2,$3,$4,$5)`, [id, session.userId, parsed.data.name, parsed.data.currency, parsed.data.initialBalance]);
      return NextResponse.json({ ok: true, id, sheet: "Wallets", storage: "PostgreSQL" });
    }

    if (entity.data === "remittance") {
      const parsed = z.object({ date: z.string().min(1), action: z.enum(["in", "out"]), mode: z.enum(["thb-mmk", "mmk-thb"]), sourceWalletId: z.string().uuid(), targetWalletId: z.string().uuid(), sourceAmount: z.number().positive(), rate: z.number().positive(), customerName: z.string().trim().min(1).max(100), note: z.string().trim().max(500).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid remittance data" }, { status: 400 });
      const targetAmount = parsed.data.mode === "thb-mmk" ? parsed.data.sourceAmount * parsed.data.rate : parsed.data.sourceAmount / parsed.data.rate;
      await query(`INSERT INTO remittances (id,user_id,tx_date,action,mode,source_wallet_id,target_wallet_id,source_amount,rate,target_amount,customer_name,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [id, session.userId, parsed.data.date, parsed.data.action, parsed.data.mode, parsed.data.sourceWalletId, parsed.data.targetWalletId, parsed.data.sourceAmount, parsed.data.rate, targetAmount, parsed.data.customerName, parsed.data.note || ""]);
      return NextResponse.json({ ok: true, id, sheet: "Remittances", storage: "PostgreSQL" });
    }

    if (entity.data === "debt") {
      const parsed = z.object({ date: z.string().min(1), type: z.enum(["receivable", "payable"]), name: z.string().trim().min(1).max(100), currency, amount: z.number().positive(), walletId: z.string().uuid().optional().or(z.literal("")), note: z.string().trim().max(500).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid debt data" }, { status: 400 });
      await query(`INSERT INTO debts (id,user_id,tx_date,debt_type,name,currency,amount,wallet_id,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, session.userId, parsed.data.date, parsed.data.type, parsed.data.name, parsed.data.currency, parsed.data.amount, parsed.data.walletId || null, parsed.data.note || ""]);
      return NextResponse.json({ ok: true, id, sheet: "Debts", storage: "PostgreSQL" });
    }

    if (entity.data === "lottery") {
      const parsed = z.object({ date: z.string().min(1), type: z.enum(["2D", "3D", "Other"]), currency, number: z.string().trim().min(1).max(20), customerName: z.string().trim().min(1).max(100), betAmount: z.number().positive(), payoutMultiplier: z.number().positive(), note: z.string().trim().max(500).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid lottery data" }, { status: 400 });
      const digits = parsed.data.number.replace(/\D/g, "");
      if ((parsed.data.type === "2D" && digits.length !== 2) || (parsed.data.type === "3D" && digits.length !== 3)) return NextResponse.json({ error: `${parsed.data.type} number is invalid` }, { status: 400 });
      await query(`INSERT INTO lottery_entries (id,user_id,draw_date,lottery_type,currency,number,customer_name,bet_amount,payout_multiplier,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.number, parsed.data.customerName, parsed.data.betAmount, parsed.data.payoutMultiplier, parsed.data.note || ""]);
      return NextResponse.json({ ok: true, id, sheet: "LotteryEntries", storage: "PostgreSQL", walletChanged: false });
    }

    const parsed = z.object({ date: z.string().min(1), type: z.enum(["2D", "3D", "Other"]), currency, winningNumber: z.string().trim().min(1).max(20) }).safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "Invalid winning number" }, { status: 400 });
    const result = await transaction(async (client) => {
      await client.query(`INSERT INTO lottery_results (id,user_id,draw_date,lottery_type,currency,winning_number) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id,draw_date,lottery_type,currency) DO UPDATE SET winning_number=EXCLUDED.winning_number, created_at=now()`, [id, session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.winningNumber]);
      await client.query(`UPDATE lottery_entries SET result_status=CASE WHEN number=$5 THEN 'won' ELSE 'lost' END, payout_amount=CASE WHEN number=$5 THEN bet_amount*payout_multiplier ELSE 0 END WHERE user_id=$1 AND draw_date=$2 AND lottery_type=$3 AND currency=$4 AND deleted_at IS NULL`, [session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.winningNumber]);
      return client.query(`SELECT id, customer_name, number, bet_amount, payout_multiplier, payout_amount, currency FROM lottery_entries WHERE user_id=$1 AND draw_date=$2 AND lottery_type=$3 AND currency=$4 AND number=$5 AND deleted_at IS NULL ORDER BY created_at`, [session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.winningNumber]);
    });
    return NextResponse.json({ ok: true, sheet: "LotteryResults", storage: "PostgreSQL", winners: result.rows.map((row) => ({ id: row.id, customerName: row.customer_name, number: row.number, betAmount: num(row.bet_amount), payoutMultiplier: num(row.payout_multiplier), payoutAmount: num(row.payout_amount), currency: row.currency })), winnerCount: result.rowCount || 0 });
  } catch (error) {
    console.error("Premium POST", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database write failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();

    if (body.action === "settleLotteryDealer") {
      const parsed = z.object({ action: z.literal("settleLotteryDealer"), date: z.string().min(1), type: z.enum(["2D", "3D", "Other"]), currency, walletId: z.string().uuid() }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid dealer settlement" }, { status: 400 });
      const settled = await transaction(async (client) => {
        const wallet = await client.query(`SELECT id,currency FROM wallets WHERE id=$1 AND user_id=$2 AND status <> 'Deleted' FOR UPDATE`, [parsed.data.walletId, session.userId]);
        if (!wallet.rows[0]) throw new Error("Wallet not found");
        if (wallet.rows[0].currency !== parsed.data.currency) throw new Error("Wallet currency does not match lottery currency");
        const pendingRows = await client.query(`SELECT id, bet_amount FROM lottery_entries WHERE user_id=$1 AND draw_date=$2 AND lottery_type=$3 AND currency=$4 AND dealer_status='pending' AND deleted_at IS NULL FOR UPDATE`, [session.userId, parsed.data.date, parsed.data.type, parsed.data.currency]);
        const amount = pendingRows.rows.reduce((sum, row) => sum + num(row.bet_amount), 0);
        const count = pendingRows.rowCount || 0;
        if (count === 0 || amount <= 0) throw new Error("No pending lottery entries for this draw");
        const referenceId = crypto.randomUUID();
        await client.query(`INSERT INTO wallet_ledger (id,user_id,wallet_id,amount,entry_type,reference_type,reference_id,note) VALUES ($1,$2,$3,$4,'debit','lottery_dealer_settlement',$5,$6)`, [crypto.randomUUID(), session.userId, parsed.data.walletId, -amount, referenceId, `${parsed.data.date} ${parsed.data.type} dealer settlement`]);
        await client.query(`UPDATE lottery_entries SET dealer_status='settled', dealer_wallet_id=$5, dealer_settled_at=now() WHERE user_id=$1 AND draw_date=$2 AND lottery_type=$3 AND currency=$4 AND dealer_status='pending' AND deleted_at IS NULL`, [session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.walletId]);
        return { amount, count, referenceId };
      });
      return NextResponse.json({ ok: true, sheet: "LotteryDealerSettlement", storage: "PostgreSQL", ...settled });
    }

    const parsed = z.object({ entity: z.literal("debt"), id: z.string().uuid(), status: z.enum(["paid", "unpaid"]) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    const updated = await query(`UPDATE debts SET status=$1 WHERE id=$2 AND user_id=$3 RETURNING id`, [parsed.data.status, parsed.data.id, session.userId]);
    if (!updated.rowCount) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    return NextResponse.json({ ok: true, sheet: "Debts", storage: "PostgreSQL" });
  } catch (error) {
    console.error("Premium PATCH", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database update failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = z.object({ entity: z.enum(["wallet", "remittance", "debt", "lottery"]), id: z.string().uuid() }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
    const config = {
      wallet: [`UPDATE wallets SET status='Deleted' WHERE id=$1 AND user_id=$2`, "Wallets"],
      remittance: [`UPDATE remittances SET status='Deleted' WHERE id=$1 AND user_id=$2`, "Remittances"],
      debt: [`UPDATE debts SET status='Deleted' WHERE id=$1 AND user_id=$2`, "Debts"],
      lottery: [`UPDATE lottery_entries SET deleted_at=now() WHERE id=$1 AND user_id=$2 AND dealer_status='pending'`, "LotteryEntries"],
    } as const;
    const [sql, sheet] = config[parsed.data.entity];
    const deleted = await query(sql, [parsed.data.id, session.userId]);
    if (!deleted.rowCount) return NextResponse.json({ error: "Record not found or already settled" }, { status: 404 });
    return NextResponse.json({ ok: true, sheet, storage: "PostgreSQL" });
  } catch (error) {
    console.error("Premium DELETE", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database delete failed" }, { status: 500 });
  }
}
