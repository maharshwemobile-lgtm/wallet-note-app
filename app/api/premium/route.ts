import { NextResponse } from "next/server";
import { z } from "zod";
import { query, transaction } from "@/lib/db";
import { readSession } from "@/lib/auth";

const currency = z.enum(["MMK", "THB"]);
const lotteryType = z.enum(["2D", "3D", "Other"]);
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const asDate = (value: unknown) => String(value || new Date().toISOString().slice(0, 10)).slice(0, 10);

async function requireUser() {
  const session = await readSession();
  return session || null;
}

function interestAmount(principal: number, mode: string, value: number) {
  if (mode === "percent") return principal * value / 100;
  if (mode === "kyat-per-hundred") return principal * value / 100;
  return 0;
}

function cycleKey(type: string, date: string) {
  if (type === "3D") {
    const d = new Date(`${date}T00:00:00Z`);
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - day + 1);
    return `${d.toISOString().slice(0, 10)}-week`;
  }
  return date;
}

export async function GET() {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = session.userId;

    const [walletResult, remittanceResult, debtResult, debtPaymentResult, lotteryResult, resultResult, settlementResult, ledgerResult, endUserResult] = await Promise.all([
      query(`SELECT id, name, currency, initial_balance, status, created_at FROM wallets WHERE user_id=$1 AND status <> 'Deleted' ORDER BY created_at DESC`, [userId]),
      query(`SELECT id, tx_date, action, mode, source_wallet_id, target_wallet_id, source_amount, rate, target_amount, fee_amount, total_amount, transfer_method, status_detail, customer_name, note, status, created_at FROM remittances WHERE user_id=$1 AND status <> 'Deleted' ORDER BY tx_date DESC, created_at DESC`, [userId]),
      query(`SELECT id, tx_date, debt_type, name, currency, amount, principal_amount, interest_mode, interest_label, interest_value, repayment_plan, start_date, due_date, installment_amount, paid_amount, wallet_id, note, status, created_at FROM debts WHERE user_id=$1 AND status <> 'Deleted' ORDER BY tx_date DESC, created_at DESC`, [userId]),
      query(`SELECT debt_id, COALESCE(SUM(amount),0) paid FROM debt_payments WHERE user_id=$1 GROUP BY debt_id`, [userId]),
      query(`SELECT id, draw_date, cycle_key, lottery_type, currency, number, customer_name, bet_amount, payout_multiplier, note, payment_status, dealer_status, dealer_wallet_id, dealer_settled_at, result_status, payout_status, payout_amount, source_end_user_id, lottery_debt_id, created_at FROM lottery_entries WHERE user_id=$1 AND deleted_at IS NULL ORDER BY draw_date DESC, created_at DESC`, [userId]),
      query(`SELECT id, draw_date, lottery_type, currency, winning_number, created_at FROM lottery_results WHERE user_id=$1 ORDER BY draw_date DESC, created_at DESC`, [userId]),
      query(`SELECT id, draw_date, lottery_type, currency, wallet_id, gross_amount, commission_mode, commission_value, commission_amount, net_amount, entry_count, created_at FROM lottery_dealer_settlements WHERE user_id=$1 ORDER BY draw_date DESC, created_at DESC`, [userId]),
      query(`SELECT wallet_id, COALESCE(SUM(amount),0) total FROM wallet_ledger WHERE user_id=$1 GROUP BY wallet_id`, [userId]),
      query(`SELECT id, name, email, username, role, status, link_token, link_enabled, max_bet_per_number, max_bet_per_draw, created_at FROM users WHERE owner_id=$1 ORDER BY created_at DESC`, [userId]),
    ]);

    const wallets = walletResult.rows.map((row) => ({
      id: row.id, name: row.name, currency: row.currency,
      initialBalance: num(row.initial_balance), balance: num(row.initial_balance),
      status: row.status, createdAt: row.created_at,
    }));
    const balanceMap = new Map(wallets.map((wallet) => [wallet.id, wallet.balance]));

    for (const row of remittanceResult.rows) {
      if (balanceMap.has(row.source_wallet_id)) balanceMap.set(row.source_wallet_id, num(balanceMap.get(row.source_wallet_id)) - num(row.source_amount));
      if (balanceMap.has(row.target_wallet_id)) balanceMap.set(row.target_wallet_id, num(balanceMap.get(row.target_wallet_id)) + num(row.target_amount));
    }
    for (const row of debtResult.rows) {
      const paid = num(row.paid_amount);
      if ((row.status === "paid" || paid > 0) && row.wallet_id && balanceMap.has(row.wallet_id)) {
        balanceMap.set(row.wallet_id, num(balanceMap.get(row.wallet_id)) + (row.debt_type === "receivable" ? paid : -paid));
      }
    }
    for (const row of ledgerResult.rows) {
      if (balanceMap.has(row.wallet_id)) balanceMap.set(row.wallet_id, num(balanceMap.get(row.wallet_id)) + num(row.total));
    }
    for (const wallet of wallets) wallet.balance = num(balanceMap.get(wallet.id));

    const paidByDebt = new Map(debtPaymentResult.rows.map((row) => [row.debt_id, num(row.paid)]));
    const debts = debtResult.rows.map((row) => {
      const principal = num(row.principal_amount ?? row.amount);
      const interest = interestAmount(principal, row.interest_mode, num(row.interest_value));
      const total = principal + interest;
      const paid = Math.max(num(row.paid_amount), num(paidByDebt.get(row.id)));
      return {
        id: row.id, date: row.tx_date, type: row.debt_type, name: row.name, currency: row.currency,
        amount: num(row.amount), principalAmount: principal, interestAmount: interest, totalAmount: total,
        interestMode: row.interest_mode, interestLabel: row.interest_label, interestValue: num(row.interest_value),
        repaymentPlan: row.repayment_plan, startDate: row.start_date || "", dueDate: row.due_date || "",
        installmentAmount: num(row.installment_amount), paidAmount: paid, remainingAmount: Math.max(total - paid, 0),
        walletId: row.wallet_id || "", note: row.note, status: row.status, createdAt: row.created_at,
      };
    });

    const remittances = remittanceResult.rows.map((row) => ({
      id: row.id, date: row.tx_date, action: row.action, mode: row.mode,
      sourceWalletId: row.source_wallet_id, targetWalletId: row.target_wallet_id,
      sourceAmount: num(row.source_amount), rate: num(row.rate), targetAmount: num(row.target_amount),
      feeAmount: num(row.fee_amount), totalAmount: num(row.total_amount), transferMethod: row.transfer_method,
      statusDetail: row.status_detail, customerName: row.customer_name, note: row.note, status: row.status, createdAt: row.created_at,
    }));

    const lotteries = lotteryResult.rows.map((row) => ({
      id: row.id, date: row.draw_date, cycleKey: row.cycle_key || cycleKey(row.lottery_type, String(row.draw_date).slice(0, 10)),
      type: row.lottery_type, currency: row.currency, number: row.number, customerName: row.customer_name,
      betAmount: num(row.bet_amount), payoutMultiplier: num(row.payout_multiplier), note: row.note,
      paymentStatus: row.payment_status, status: row.dealer_status, dealerWalletId: row.dealer_wallet_id || "",
      dealerSettledAt: row.dealer_settled_at || "", resultStatus: row.result_status,
      payoutStatus: row.payout_status, payoutAmount: num(row.payout_amount), sourceEndUserId: row.source_end_user_id || "",
      lotteryDebtId: row.lottery_debt_id || "", createdAt: row.created_at,
    }));
    const results = resultResult.rows.map((row) => ({ id: row.id, date: row.draw_date, type: row.lottery_type, currency: row.currency, winningNumber: row.winning_number, createdAt: row.created_at }));
    const settlements = settlementResult.rows.map((row) => ({ id: row.id, date: row.draw_date, type: row.lottery_type, currency: row.currency, walletId: row.wallet_id, grossAmount: num(row.gross_amount), commissionMode: row.commission_mode, commissionValue: num(row.commission_value), commissionAmount: num(row.commission_amount), netAmount: num(row.net_amount), entryCount: Number(row.entry_count || 0), createdAt: row.created_at }));
    const endUsers = endUserResult.rows.map((row) => ({ id: row.id, name: row.name, email: row.email, username: row.username, role: row.role, status: row.status, linkToken: row.link_token || "", linkEnabled: row.link_enabled, maxBetPerNumber: num(row.max_bet_per_number), maxBetPerDraw: num(row.max_bet_per_draw), createdAt: row.created_at }));

    const debtSummary = { receivable: { MMK: 0, THB: 0 }, payable: { MMK: 0, THB: 0 } };
    for (const row of debts) if (row.status !== "paid") debtSummary[row.type === "payable" ? "payable" : "receivable"][row.currency === "THB" ? "THB" : "MMK"] += row.remainingAmount;

    const lotterySummary = { total: { MMK: 0, THB: 0 }, pending: { MMK: 0, THB: 0 }, settled: { MMK: 0, THB: 0 }, winning: { MMK: 0, THB: 0 }, unpaidPayout: { MMK: 0, THB: 0 } };
    for (const row of lotteries) {
      const curr = row.currency === "THB" ? "THB" : "MMK";
      lotterySummary.total[curr] += row.betAmount;
      lotterySummary[row.status === "settled" ? "settled" : "pending"][curr] += row.betAmount;
      if (row.resultStatus === "won") lotterySummary.winning[curr] += row.payoutAmount;
      if (row.resultStatus === "won" && row.payoutStatus !== "paid") lotterySummary.unpaidPayout[curr] += row.payoutAmount;
    }
    const winners = lotteries.filter((row) => row.resultStatus === "won");

    return NextResponse.json({
      storage: { provider: "PostgreSQL", connected: true, spreadsheetTitle: "PostgreSQL Main Database" },
      wallets, remittances, debts, lotteries, results, settlements, endUsers, winners, debtSummary, lotterySummary,
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
    const entity = z.enum(["wallet", "remittance", "debt", "debtPayment", "lottery", "lotteryResult"]).safeParse(body.entity);
    if (!entity.success) return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    const id = crypto.randomUUID();

    if (entity.data === "wallet") {
      const parsed = z.object({ name: z.string().trim().min(1).max(80), currency, initialBalance: z.number().min(0) }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid wallet data" }, { status: 400 });
      await query(`INSERT INTO wallets (id,user_id,name,currency,initial_balance) VALUES ($1,$2,$3,$4,$5)`, [id, session.userId, parsed.data.name, parsed.data.currency, parsed.data.initialBalance]);
      return NextResponse.json({ ok: true, id, sheet: "Wallets", storage: "PostgreSQL" });
    }

    if (entity.data === "remittance") {
      const parsed = z.object({ date: z.string().min(1), action: z.enum(["mmk-thb", "thb-mmk"]), sourceWalletId: z.string().uuid(), targetWalletId: z.string().uuid(), sourceAmount: z.number().positive(), rate: z.number().min(0).optional(), targetAmount: z.number().min(0).optional(), feeAmount: z.number().min(0).optional(), transferMethod: z.enum(["Cash", "Wallet"]).optional(), statusDetail: z.string().trim().max(40).optional(), customerName: z.string().trim().min(1).max(100), note: z.string().trim().max(500).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid remittance data" }, { status: 400 });
      const rate = parsed.data.rate ?? 0;
      const computedTarget = parsed.data.targetAmount && parsed.data.targetAmount > 0 ? parsed.data.targetAmount : (rate > 0 ? (parsed.data.action === "thb-mmk" ? parsed.data.sourceAmount * rate : parsed.data.sourceAmount / rate) : 0);
      if (computedTarget <= 0) return NextResponse.json({ error: "Target amount or rate is required" }, { status: 400 });
      const feeAmount = parsed.data.feeAmount ?? 0;
      const totalAmount = computedTarget + feeAmount;
      await query(`INSERT INTO remittances (id,user_id,tx_date,action,mode,source_wallet_id,target_wallet_id,source_amount,rate,target_amount,fee_amount,total_amount,transfer_method,status_detail,customer_name,note,created_by) VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$2)`, [id, session.userId, parsed.data.date, parsed.data.action, parsed.data.sourceWalletId, parsed.data.targetWalletId, parsed.data.sourceAmount, rate, computedTarget, feeAmount, totalAmount, parsed.data.transferMethod || "Cash", parsed.data.statusDetail || (parsed.data.transferMethod === "Wallet" ? "လွှဲရန်" : "ထုတ်ပေးရန်"), parsed.data.customerName, parsed.data.note || ""]);
      return NextResponse.json({ ok: true, id, sheet: "Remittances", storage: "PostgreSQL" });
    }

    if (entity.data === "debt") {
      const parsed = z.object({ date: z.string().min(1), type: z.enum(["receivable", "payable"]), name: z.string().trim().min(1).max(100), currency, amount: z.number().positive(), interestMode: z.enum(["none", "percent", "kyat-per-hundred"]).optional(), interestValue: z.number().min(0).optional(), interestLabel: z.string().trim().max(40).optional(), repaymentPlan: z.enum(["one-time", "monthly", "yearly", "custom"]).optional(), startDate: z.string().optional(), dueDate: z.string().optional(), installmentAmount: z.number().min(0).optional(), walletId: z.string().uuid().optional().or(z.literal("")), note: z.string().trim().max(500).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid debt data" }, { status: 400 });
      const interestMode = parsed.data.interestMode || "none";
      const interestValue = parsed.data.interestValue || 0;
      const interest = interestAmount(parsed.data.amount, interestMode, interestValue);
      const total = parsed.data.amount + interest;
      await query(`INSERT INTO debts (id,user_id,tx_date,debt_type,name,currency,amount,principal_amount,interest_mode,interest_label,interest_value,repayment_plan,start_date,due_date,installment_amount,wallet_id,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [id, session.userId, parsed.data.date, parsed.data.type, parsed.data.name, parsed.data.currency, total, interestMode, parsed.data.interestLabel || (interestMode === "kyat-per-hundred" ? `${interestValue} ကျပ်တိုး` : ""), interestValue, parsed.data.repaymentPlan || "one-time", parsed.data.startDate || parsed.data.date, parsed.data.dueDate || null, parsed.data.installmentAmount || 0, parsed.data.walletId || null, parsed.data.note || ""]);
      return NextResponse.json({ ok: true, id, sheet: "Debts", storage: "PostgreSQL" });
    }

    if (entity.data === "debtPayment") {
      const parsed = z.object({ debtId: z.string().uuid(), walletId: z.string().uuid().optional().or(z.literal("")), amount: z.number().positive(), note: z.string().trim().max(300).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid debt payment" }, { status: 400 });
      await transaction(async (client) => {
        await client.query(`INSERT INTO debt_payments (id,user_id,debt_id,wallet_id,amount,note) VALUES ($1,$2,$3,$4,$5,$6)`, [id, session.userId, parsed.data.debtId, parsed.data.walletId || null, parsed.data.amount, parsed.data.note || ""]);
        const debt = await client.query(`SELECT amount, paid_amount FROM debts WHERE id=$1 AND user_id=$2`, [parsed.data.debtId, session.userId]);
        if (!debt.rows[0]) throw new Error("Debt not found");
        const paid = num(debt.rows[0].paid_amount) + parsed.data.amount;
        const status = paid >= num(debt.rows[0].amount) ? "paid" : "partial";
        await client.query(`UPDATE debts SET paid_amount=$1,status=$2 WHERE id=$3 AND user_id=$4`, [paid, status, parsed.data.debtId, session.userId]);
      });
      return NextResponse.json({ ok: true, id, sheet: "DebtPayments", storage: "PostgreSQL" });
    }

    if (entity.data === "lottery") {
      const parsed = z.object({ date: z.string().min(1), type: lotteryType, currency, number: z.string().trim().min(1).max(20), customerName: z.string().trim().min(1).max(100), betAmount: z.number().positive(), payoutMultiplier: z.number().positive(), paymentStatus: z.enum(["cash_paid", "wallet_paid", "debt"]).optional(), note: z.string().trim().max(500).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid lottery data" }, { status: 400 });
      const digits = parsed.data.number.replace(/\D/g, "");
      if ((parsed.data.type === "2D" && digits.length !== 2) || (parsed.data.type === "3D" && digits.length !== 3)) return NextResponse.json({ error: `${parsed.data.type} number is invalid` }, { status: 400 });
      const ck = cycleKey(parsed.data.type, parsed.data.date);
      let debtId: string | null = null;
      if (parsed.data.paymentStatus === "debt") {
        debtId = crypto.randomUUID();
        await query(`INSERT INTO debts (id,user_id,tx_date,debt_type,name,currency,amount,principal_amount,note,status) VALUES ($1,$2,$3,'receivable',$4,$5,$6,$6,$7,'unpaid')`, [debtId, session.userId, parsed.data.date, parsed.data.customerName, parsed.data.currency, parsed.data.betAmount, `Lottery debt ${parsed.data.type} ${parsed.data.number}`]);
      }
      await query(`INSERT INTO lottery_entries (id,user_id,draw_date,cycle_key,lottery_type,currency,number,customer_name,bet_amount,payout_multiplier,payment_status,lottery_debt_id,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [id, session.userId, parsed.data.date, ck, parsed.data.type, parsed.data.currency, parsed.data.number, parsed.data.customerName, parsed.data.betAmount, parsed.data.payoutMultiplier, parsed.data.paymentStatus || "cash_paid", debtId, parsed.data.note || ""]);
      return NextResponse.json({ ok: true, id, sheet: "LotteryEntries", storage: "PostgreSQL", walletChanged: false });
    }

    const parsed = z.object({ date: z.string().min(1), type: lotteryType, currency, winningNumber: z.string().trim().min(1).max(20) }).safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "Invalid winning number" }, { status: 400 });
    const result = await transaction(async (client) => {
      await client.query(`INSERT INTO lottery_results (id,user_id,draw_date,lottery_type,currency,winning_number) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id,draw_date,lottery_type,currency) DO UPDATE SET winning_number=EXCLUDED.winning_number, created_at=now()`, [id, session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.winningNumber]);
      await client.query(`UPDATE lottery_entries SET result_status=CASE WHEN number=$5 THEN 'won' ELSE 'lost' END, payout_status=CASE WHEN number=$5 THEN payout_status ELSE 'unpaid' END, payout_amount=CASE WHEN number=$5 THEN bet_amount*payout_multiplier ELSE 0 END WHERE user_id=$1 AND draw_date=$2 AND lottery_type=$3 AND currency=$4 AND deleted_at IS NULL`, [session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.winningNumber]);
      return client.query(`SELECT id, customer_name, number, bet_amount, payout_multiplier, payout_amount, payout_status, currency FROM lottery_entries WHERE user_id=$1 AND draw_date=$2 AND lottery_type=$3 AND currency=$4 AND number=$5 AND deleted_at IS NULL ORDER BY created_at`, [session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.winningNumber]);
    });
    return NextResponse.json({ ok: true, sheet: "LotteryResults", storage: "PostgreSQL", winners: result.rows.map((row) => ({ id: row.id, customerName: row.customer_name, number: row.number, betAmount: num(row.bet_amount), payoutMultiplier: num(row.payout_multiplier), payoutAmount: num(row.payout_amount), payoutStatus: row.payout_status, currency: row.currency })), winnerCount: result.rowCount || 0 });
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
      const parsed = z.object({ action: z.literal("settleLotteryDealer"), date: z.string().min(1), type: lotteryType, currency, walletId: z.string().uuid(), commissionMode: z.enum(["none", "percent", "fixed"]).optional(), commissionValue: z.number().min(0).optional() }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid dealer settlement" }, { status: 400 });
      const settled = await transaction(async (client) => {
        const wallet = await client.query(`SELECT id,currency FROM wallets WHERE id=$1 AND user_id=$2 AND status <> 'Deleted' FOR UPDATE`, [parsed.data.walletId, session.userId]);
        if (!wallet.rows[0]) throw new Error("Wallet not found");
        if (wallet.rows[0].currency !== parsed.data.currency) throw new Error("Wallet currency does not match lottery currency");
        const pendingRows = await client.query(`SELECT id, bet_amount FROM lottery_entries WHERE user_id=$1 AND draw_date=$2 AND lottery_type=$3 AND currency=$4 AND dealer_status='pending' AND deleted_at IS NULL FOR UPDATE`, [session.userId, parsed.data.date, parsed.data.type, parsed.data.currency]);
        const gross = pendingRows.rows.reduce((sum, row) => sum + num(row.bet_amount), 0);
        const count = pendingRows.rowCount || 0;
        if (count === 0 || gross <= 0) throw new Error("No pending lottery entries for this draw");
        const commissionMode = parsed.data.commissionMode || "none";
        const commissionValue = parsed.data.commissionValue || 0;
        const commission = commissionMode === "percent" ? gross * commissionValue / 100 : commissionMode === "fixed" ? commissionValue : 0;
        const net = Math.max(gross - commission, 0);
        const settlementId = crypto.randomUUID();
        await client.query(`INSERT INTO lottery_dealer_settlements (id,user_id,draw_date,lottery_type,currency,wallet_id,gross_amount,commission_mode,commission_value,commission_amount,net_amount,entry_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [settlementId, session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.walletId, gross, commissionMode, commissionValue, commission, net, count]);
        await client.query(`INSERT INTO wallet_ledger (id,user_id,wallet_id,amount,entry_type,reference_type,reference_id,note) VALUES ($1,$2,$3,$4,'debit','lottery_dealer_settlement',$5,$6)`, [crypto.randomUUID(), session.userId, parsed.data.walletId, -net, settlementId, `${parsed.data.date} ${parsed.data.type} dealer settlement net`]);
        await client.query(`UPDATE lottery_entries SET dealer_status='settled', dealer_wallet_id=$5, dealer_settled_at=now() WHERE user_id=$1 AND draw_date=$2 AND lottery_type=$3 AND currency=$4 AND dealer_status='pending' AND deleted_at IS NULL`, [session.userId, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.walletId]);
        return { id: settlementId, grossAmount: gross, commissionAmount: commission, netAmount: net, count };
      });
      return NextResponse.json({ ok: true, sheet: "LotteryDealerSettlement", storage: "PostgreSQL", ...settled });
    }

    if (body.action === "updateWinnerPayout") {
      const parsed = z.object({ action: z.literal("updateWinnerPayout"), id: z.string().uuid(), payoutStatus: z.enum(["paid", "unpaid"]) }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid payout update" }, { status: 400 });
      const updated = await query(`UPDATE lottery_entries SET payout_status=$1 WHERE id=$2 AND user_id=$3 AND result_status='won' RETURNING id`, [parsed.data.payoutStatus, parsed.data.id, session.userId]);
      if (!updated.rowCount) return NextResponse.json({ error: "Winner not found" }, { status: 404 });
      return NextResponse.json({ ok: true, sheet: "LotteryPayout", storage: "PostgreSQL" });
    }

    if (body.action === "updateRemittanceStatus") {
      const parsed = z.object({ action: z.literal("updateRemittanceStatus"), id: z.string().uuid(), statusDetail: z.string().trim().min(1).max(40) }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      await query(`UPDATE remittances SET status_detail=$1 WHERE id=$2 AND user_id=$3`, [parsed.data.statusDetail, parsed.data.id, session.userId]);
      return NextResponse.json({ ok: true, sheet: "Remittances", storage: "PostgreSQL" });
    }

    const parsed = z.object({ entity: z.literal("debt"), id: z.string().uuid(), status: z.enum(["unpaid", "partial", "paid", "overdue"]) }).safeParse(body);
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
