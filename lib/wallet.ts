import { appendRow, getObjectRows } from "./sheets";
import type { Currency, WalletTxType } from "./types";

export async function getBalances(userId: string) {
  const rows = await getObjectRows("WalletTransactions");
  const approved = rows.filter(r => r.userId === userId && r.status === "Approved");
  const sum = (currency: Currency) => approved.filter(r => r.currency === currency).reduce((a, r) => a + Number(r.signedAmount || 0), 0);
  return { THB: sum("THB"), MMK: sum("MMK") };
}

export async function recordWalletTransaction(input: { userId: string; type: WalletTxType; currency: Currency; amount: number; status?: string; referenceType?: string; referenceId?: string; note?: string; }) {
  const id = crypto.randomUUID();
  const direction = ["CASH_OUT", "EXCHANGE_OUT", "BET"].includes(input.type) ? -1 : 1;
  const status = input.status ?? "Approved";
  const signedAmount = status === "Approved" ? input.amount * direction : 0;
  await appendRow("WalletTransactions!A:J", [id, input.userId, new Date().toISOString(), input.type, input.currency, input.amount, signedAmount, status, input.referenceType ?? "", input.referenceId ?? input.note ?? ""]);
  return id;
}
