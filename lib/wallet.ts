import { appendRow, getObjectRows } from "./sheets";
import type { Currency, WalletTxType } from "./types";

export async function getBalances(spreadsheetId: string) {
  const rows = await getObjectRows("WalletTransactions", spreadsheetId);
  const approved = rows.filter((row) => row.status === "Approved");
  const sum = (currency: Currency) => approved
    .filter((row) => row.currency === currency)
    .reduce((total, row) => total + Number(row.signedAmount || 0), 0);
  return { THB: sum("THB"), MMK: sum("MMK") };
}

export async function recordWalletTransaction(
  spreadsheetId: string,
  input: {
    type: WalletTxType;
    currency: Currency;
    amount: number;
    status?: string;
    referenceType?: string;
    referenceId?: string;
    note?: string;
  },
) {
  const id = crypto.randomUUID();
  const direction = ["CASH_OUT", "EXCHANGE_OUT", "BET"].includes(input.type) ? -1 : 1;
  const status = input.status ?? "Approved";
  const signedAmount = status === "Approved" ? input.amount * direction : 0;
  await appendRow("WalletTransactions!A:I", [
    id,
    new Date().toISOString(),
    input.type,
    input.currency,
    input.amount,
    signedAmount,
    status,
    input.referenceType ?? "",
    input.referenceId ?? input.note ?? "",
  ], spreadsheetId);
  return id;
}
