import { NextResponse } from "next/server";
import { z } from "zod";
import { appendRow, ensureUserSpreadsheetTabs, findRowIndex, getObjectRows, updateRange } from "@/lib/sheets";
import { requireUserSheet } from "@/lib/user-sheet";

const currencySchema = z.enum(["MMK", "THB"]);
const entitySchema = z.enum(["wallet", "remittance", "debt", "lottery"]);

function number(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function active<T extends Record<string, string>>(rows: T[]) {
  return rows.filter((row) => row.status !== "Deleted");
}

async function loadWorkspace(spreadsheetId: string) {
  const spreadsheetTitle = await ensureUserSpreadsheetTabs(spreadsheetId);
  const [walletRows, remittanceRows, debtRows, lotteryRows] = await Promise.all([
    getObjectRows("Wallets", spreadsheetId),
    getObjectRows("Remittances", spreadsheetId),
    getObjectRows("Debts", spreadsheetId),
    getObjectRows("LotteryEntries", spreadsheetId),
  ]);

  const wallets = active(walletRows);
  const remittances = active(remittanceRows);
  const debts = active(debtRows);
  const lotteries = active(lotteryRows);
  const balances: Record<string, number> = Object.fromEntries(
    wallets.map((wallet) => [wallet.id, number(wallet.initialBalance)]),
  );

  for (const remit of remittances) {
    if (remit.sourceWalletId in balances) balances[remit.sourceWalletId] -= number(remit.sourceAmount);
    if (remit.targetWalletId in balances) balances[remit.targetWalletId] += number(remit.targetAmount);
  }

  for (const debt of debts) {
    if (debt.status !== "paid" || !debt.walletId || !(debt.walletId in balances)) continue;
    balances[debt.walletId] += debt.type === "receivable" ? number(debt.amount) : -number(debt.amount);
  }

  // Lottery entries are an agent ledger. They never change wallet balances.
  const debtSummary = { receivable: { MMK: 0, THB: 0 }, payable: { MMK: 0, THB: 0 } };
  for (const debt of debts) {
    if (debt.status !== "unpaid") continue;
    const type = debt.type === "payable" ? "payable" : "receivable";
    const currency = debt.currency === "THB" ? "THB" : "MMK";
    debtSummary[type][currency] += number(debt.amount);
  }

  const lotterySummary = {
    total: { MMK: 0, THB: 0 },
    pending: { MMK: 0, THB: 0 },
    settled: { MMK: 0, THB: 0 },
  };
  for (const lottery of lotteries) {
    const currency = lottery.currency === "THB" ? "THB" : "MMK";
    const amount = number(lottery.betAmount);
    lotterySummary.total[currency] += amount;
    if (lottery.status === "settled") lotterySummary.settled[currency] += amount;
    else lotterySummary.pending[currency] += amount;
  }

  return {
    storage: {
      provider: "Google Sheets",
      connected: true,
      spreadsheetTitle,
      spreadsheetIdMasked: `${spreadsheetId.slice(0, 6)}...${spreadsheetId.slice(-4)}`,
    },
    wallets: wallets.map((wallet) => ({
      ...wallet,
      initialBalance: number(wallet.initialBalance),
      balance: balances[wallet.id] ?? 0,
    })),
    remittances: remittances.reverse(),
    debts: debts.reverse(),
    lotteries: lotteries.reverse(),
    debtSummary,
    lotterySummary,
  };
}

export async function GET() {
  try {
    const access = await requireUserSheet();
    if ("error" in access) {
      return NextResponse.json(
        { error: access.error, needsSheet: access.status === 428 },
        { status: access.status },
      );
    }
    return NextResponse.json(await loadWorkspace(access.spreadsheetId));
  } catch (error) {
    console.error("Premium workspace GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Sheet connection failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireUserSheet();
    if ("error" in access) {
      return NextResponse.json(
        { error: access.error, needsSheet: access.status === 428 },
        { status: access.status },
      );
    }

    await ensureUserSpreadsheetTabs(access.spreadsheetId);
    const body = await req.json();
    const entity = entitySchema.safeParse(body.entity);
    if (!entity.success) return NextResponse.json({ error: "Invalid entity" }, { status: 400 });

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    let sheet = "";

    if (entity.data === "wallet") {
      const parsed = z.object({
        name: z.string().trim().min(1).max(80),
        currency: currencySchema,
        initialBalance: z.number().min(0),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid wallet data" }, { status: 400 });
      sheet = "Wallets";
      await appendRow(
        "Wallets!A:F",
        [id, now, parsed.data.name, parsed.data.currency, parsed.data.initialBalance, "Active"],
        access.spreadsheetId,
      );
    }

    if (entity.data === "remittance") {
      const parsed = z.object({
        date: z.string().min(1),
        action: z.enum(["in", "out"]),
        mode: z.enum(["thb-mmk", "mmk-thb"]),
        sourceWalletId: z.string().min(1),
        targetWalletId: z.string().min(1),
        sourceAmount: z.number().positive(),
        rate: z.number().positive(),
        customerName: z.string().trim().min(1).max(100),
        note: z.string().trim().max(500).optional(),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid remittance data" }, { status: 400 });
      const targetAmount = parsed.data.mode === "thb-mmk"
        ? parsed.data.sourceAmount * parsed.data.rate
        : parsed.data.sourceAmount / parsed.data.rate;
      sheet = "Remittances";
      await appendRow(
        "Remittances!A:M",
        [id, now, parsed.data.date, parsed.data.action, parsed.data.mode, parsed.data.sourceWalletId, parsed.data.targetWalletId, parsed.data.sourceAmount, parsed.data.rate, targetAmount, parsed.data.customerName, parsed.data.note ?? "", "Active"],
        access.spreadsheetId,
      );
    }

    if (entity.data === "debt") {
      const parsed = z.object({
        date: z.string().min(1),
        type: z.enum(["receivable", "payable"]),
        name: z.string().trim().min(1).max(100),
        currency: currencySchema,
        amount: z.number().positive(),
        walletId: z.string().optional(),
        note: z.string().trim().max(500).optional(),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid debt data" }, { status: 400 });
      sheet = "Debts";
      await appendRow(
        "Debts!A:J",
        [id, now, parsed.data.date, parsed.data.type, parsed.data.name, parsed.data.currency, parsed.data.amount, parsed.data.walletId ?? "", parsed.data.note ?? "", "unpaid"],
        access.spreadsheetId,
      );
    }

    if (entity.data === "lottery") {
      const parsed = z.object({
        date: z.string().min(1),
        type: z.enum(["2D", "3D", "Other"]),
        currency: currencySchema,
        number: z.string().trim().min(1).max(20),
        betAmount: z.number().positive(),
        note: z.string().trim().max(500).optional(),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid lottery data" }, { status: 400 });

      const digits = parsed.data.number.replace(/\D/g, "");
      if ((parsed.data.type === "2D" && digits.length !== 2) || (parsed.data.type === "3D" && digits.length !== 3)) {
        return NextResponse.json({ error: `${parsed.data.type} number is invalid` }, { status: 400 });
      }

      sheet = "LotteryEntries";
      // Keep the existing sheet columns for compatibility:
      // walletId is blank, odds stores optional note, status is pending/settled.
      await appendRow(
        "LotteryEntries!A:J",
        [id, now, parsed.data.date, parsed.data.type, parsed.data.currency, "", parsed.data.number, parsed.data.betAmount, parsed.data.note ?? "", "pending"],
        access.spreadsheetId,
      );
    }

    return NextResponse.json({
      ok: true,
      id,
      sheet,
      storage: "Google Sheets",
      savedAt: now,
    });
  } catch (error) {
    console.error("Premium workspace POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Sheet write failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const access = await requireUserSheet();
    if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });

    const parsed = z.object({
      entity: z.enum(["debt", "lottery"]),
      id: z.string().uuid(),
      status: z.string(),
    }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

    const sheet = parsed.data.entity === "debt" ? "Debts" : "LotteryEntries";
    const allowed = parsed.data.entity === "debt" ? ["paid", "unpaid"] : ["pending", "settled"];
    if (!allowed.includes(parsed.data.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const row = await findRowIndex(sheet, "id", parsed.data.id, access.spreadsheetId);
    if (row < 0) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    await updateRange(`${sheet}!J${row}`, [[parsed.data.status]], access.spreadsheetId);
    return NextResponse.json({ ok: true, sheet, storage: "Google Sheets" });
  } catch (error) {
    console.error("Premium workspace PATCH failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Sheet update failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await requireUserSheet();
    if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });

    const parsed = z.object({ entity: entitySchema, id: z.string().uuid() }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });

    const config = {
      wallet: ["Wallets", "F"],
      remittance: ["Remittances", "M"],
      debt: ["Debts", "J"],
      lottery: ["LotteryEntries", "J"],
    } as const;
    const [sheet, column] = config[parsed.data.entity];

    if (parsed.data.entity === "wallet") {
      const [remits, debts] = await Promise.all([
        getObjectRows("Remittances", access.spreadsheetId),
        getObjectRows("Debts", access.spreadsheetId),
      ]);
      const linked = active(remits).some((row) => row.sourceWalletId === parsed.data.id || row.targetWalletId === parsed.data.id)
        || active(debts).some((row) => row.walletId === parsed.data.id);
      if (linked) {
        return NextResponse.json(
          { error: "This wallet has linked records and cannot be deleted" },
          { status: 409 },
        );
      }
    }

    const row = await findRowIndex(sheet, "id", parsed.data.id, access.spreadsheetId);
    if (row < 0) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    await updateRange(`${sheet}!${column}${row}`, [["Deleted"]], access.spreadsheetId);
    return NextResponse.json({ ok: true, sheet, storage: "Google Sheets" });
  } catch (error) {
    console.error("Premium workspace DELETE failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Sheet delete failed" },
      { status: 500 },
    );
  }
}
