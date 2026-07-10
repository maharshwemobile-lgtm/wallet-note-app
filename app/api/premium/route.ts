import { NextResponse } from "next/server";
import { z } from "zod";
import { appendRow, ensureUserSpreadsheetTabs, findRowIndex, getObjectRows, updateRange } from "@/lib/sheets";
import { requireUserSheet } from "@/lib/user-sheet";

const currency = z.enum(["MMK", "THB"]);
const entity = z.enum(["wallet", "remittance", "debt", "lottery"]);
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const active = <T extends Record<string, string>>(rows: T[]) => rows.filter((row) => row.status !== "Deleted");

async function accessSheet() {
  const access = await requireUserSheet();
  if ("error" in access) return access;
  const spreadsheetTitle = await ensureUserSpreadsheetTabs(access.spreadsheetId);
  return { ...access, spreadsheetTitle };
}

async function workspace(spreadsheetId: string, spreadsheetTitle: string) {
  const [walletRows, remitRows, debtRows, lotteryRows] = await Promise.all([
    getObjectRows("Wallets", spreadsheetId),
    getObjectRows("Remittances", spreadsheetId),
    getObjectRows("Debts", spreadsheetId),
    getObjectRows("LotteryEntries", spreadsheetId),
  ]);
  const wallets = active(walletRows);
  const remittances = active(remitRows);
  const debts = active(debtRows);
  const lotteries = active(lotteryRows);
  const balances: Record<string, number> = Object.fromEntries(wallets.map((row) => [row.id, num(row.initialBalance)]));

  for (const row of remittances) {
    if (row.sourceWalletId in balances) balances[row.sourceWalletId] -= num(row.sourceAmount);
    if (row.targetWalletId in balances) balances[row.targetWalletId] += num(row.targetAmount);
  }
  for (const row of debts) {
    if (row.status !== "paid" || !row.walletId || !(row.walletId in balances)) continue;
    balances[row.walletId] += row.type === "receivable" ? num(row.amount) : -num(row.amount);
  }

  const debtSummary = { receivable: { MMK: 0, THB: 0 }, payable: { MMK: 0, THB: 0 } };
  for (const row of debts) {
    if (row.status !== "unpaid") continue;
    const kind = row.type === "payable" ? "payable" : "receivable";
    const curr = row.currency === "THB" ? "THB" : "MMK";
    debtSummary[kind][curr] += num(row.amount);
  }

  const lotterySummary = {
    total: { MMK: 0, THB: 0 },
    pending: { MMK: 0, THB: 0 },
    settled: { MMK: 0, THB: 0 },
  };
  for (const row of lotteries) {
    const curr = row.currency === "THB" ? "THB" : "MMK";
    const amount = num(row.betAmount);
    lotterySummary.total[curr] += amount;
    lotterySummary[row.status === "settled" ? "settled" : "pending"][curr] += amount;
  }

  return {
    storage: {
      provider: "Google Sheets",
      connected: true,
      spreadsheetTitle,
      spreadsheetIdMasked: `${spreadsheetId.slice(0, 6)}...${spreadsheetId.slice(-4)}`,
    },
    wallets: wallets.map((row) => ({ ...row, initialBalance: num(row.initialBalance), balance: balances[row.id] ?? 0 })),
    remittances: remittances.reverse(),
    debts: debts.reverse(),
    lotteries: lotteries.reverse(),
    debtSummary,
    lotterySummary,
  };
}

export async function GET() {
  try {
    const access = await accessSheet();
    if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
    return NextResponse.json(await workspace(access.spreadsheetId, access.spreadsheetTitle));
  } catch (error) {
    console.error("Premium GET", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Sheet connection failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await accessSheet();
    if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
    const body = await req.json();
    const parsedEntity = entity.safeParse(body.entity);
    if (!parsedEntity.success) return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    let sheet = "";

    if (parsedEntity.data === "wallet") {
      const parsed = z.object({ name: z.string().trim().min(1).max(80), currency, initialBalance: z.number().min(0) }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid wallet data" }, { status: 400 });
      sheet = "Wallets";
      await appendRow("Wallets!A:F", [id, now, parsed.data.name, parsed.data.currency, parsed.data.initialBalance, "Active"], access.spreadsheetId);
    }

    if (parsedEntity.data === "remittance") {
      const parsed = z.object({
        date: z.string().min(1), action: z.enum(["in", "out"]), mode: z.enum(["thb-mmk", "mmk-thb"]),
        sourceWalletId: z.string().min(1), targetWalletId: z.string().min(1), sourceAmount: z.number().positive(),
        rate: z.number().positive(), customerName: z.string().trim().min(1).max(100), note: z.string().trim().max(500).optional(),
      }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid remittance data" }, { status: 400 });
      const targetAmount = parsed.data.mode === "thb-mmk" ? parsed.data.sourceAmount * parsed.data.rate : parsed.data.sourceAmount / parsed.data.rate;
      sheet = "Remittances";
      await appendRow("Remittances!A:M", [id, now, parsed.data.date, parsed.data.action, parsed.data.mode, parsed.data.sourceWalletId, parsed.data.targetWalletId, parsed.data.sourceAmount, parsed.data.rate, targetAmount, parsed.data.customerName, parsed.data.note ?? "", "Active"], access.spreadsheetId);
    }

    if (parsedEntity.data === "debt") {
      const parsed = z.object({ date: z.string().min(1), type: z.enum(["receivable", "payable"]), name: z.string().trim().min(1).max(100), currency, amount: z.number().positive(), walletId: z.string().optional(), note: z.string().trim().max(500).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid debt data" }, { status: 400 });
      sheet = "Debts";
      await appendRow("Debts!A:J", [id, now, parsed.data.date, parsed.data.type, parsed.data.name, parsed.data.currency, parsed.data.amount, parsed.data.walletId ?? "", parsed.data.note ?? "", "unpaid"], access.spreadsheetId);
    }

    if (parsedEntity.data === "lottery") {
      const parsed = z.object({ date: z.string().min(1), type: z.enum(["2D", "3D", "Other"]), currency, number: z.string().trim().min(1).max(20), betAmount: z.number().positive(), note: z.string().trim().max(500).optional() }).safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: "Invalid lottery data" }, { status: 400 });
      const digits = parsed.data.number.replace(/\D/g, "");
      if ((parsed.data.type === "2D" && digits.length !== 2) || (parsed.data.type === "3D" && digits.length !== 3)) {
        return NextResponse.json({ error: `${parsed.data.type} number is invalid` }, { status: 400 });
      }
      sheet = "LotteryEntries";
      await appendRow("LotteryEntries!A:J", [id, now, parsed.data.date, parsed.data.type, parsed.data.currency, parsed.data.number, parsed.data.betAmount, parsed.data.note ?? "", "", "pending"], access.spreadsheetId);
    }

    return NextResponse.json({ ok: true, id, sheet, storage: "Google Sheets", savedAt: now });
  } catch (error) {
    console.error("Premium POST", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Sheet write failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const access = await accessSheet();
    if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const parsed = z.object({ entity: z.enum(["debt", "lottery"]), id: z.string().uuid(), status: z.string() }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    const sheet = parsed.data.entity === "debt" ? "Debts" : "LotteryEntries";
    const allowed = parsed.data.entity === "debt" ? ["paid", "unpaid"] : ["pending", "settled"];
    if (!allowed.includes(parsed.data.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const row = await findRowIndex(sheet, "id", parsed.data.id, access.spreadsheetId);
    if (row < 0) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    if (parsed.data.entity === "lottery") {
      await updateRange(`LotteryEntries!I${row}:J${row}`, [[parsed.data.status === "settled" ? new Date().toISOString() : "", parsed.data.status]], access.spreadsheetId);
    } else {
      await updateRange(`Debts!J${row}`, [[parsed.data.status]], access.spreadsheetId);
    }
    return NextResponse.json({ ok: true, sheet, storage: "Google Sheets" });
  } catch (error) {
    console.error("Premium PATCH", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Sheet update failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await accessSheet();
    if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const parsed = z.object({ entity, id: z.string().uuid() }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
    const config = { wallet: ["Wallets", "F"], remittance: ["Remittances", "M"], debt: ["Debts", "J"], lottery: ["LotteryEntries", "J"] } as const;
    const [sheet, column] = config[parsed.data.entity];
    if (parsed.data.entity === "wallet") {
      const [remits, debts] = await Promise.all([getObjectRows("Remittances", access.spreadsheetId), getObjectRows("Debts", access.spreadsheetId)]);
      const linked = active(remits).some((row) => row.sourceWalletId === parsed.data.id || row.targetWalletId === parsed.data.id) || active(debts).some((row) => row.walletId === parsed.data.id);
      if (linked) return NextResponse.json({ error: "This wallet has linked records and cannot be deleted" }, { status: 409 });
    }
    const row = await findRowIndex(sheet, "id", parsed.data.id, access.spreadsheetId);
    if (row < 0) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    await updateRange(`${sheet}!${column}${row}`, [["Deleted"]], access.spreadsheetId);
    return NextResponse.json({ ok: true, sheet, storage: "Google Sheets" });
  } catch (error) {
    console.error("Premium DELETE", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Sheet delete failed" }, { status: 500 });
  }
}
