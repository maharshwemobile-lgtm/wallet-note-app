export type Currency = "THB" | "MMK";
export type TxStatus = "Pending" | "Approved" | "Rejected";
export type WalletTxType = "CASH_IN" | "CASH_OUT" | "EXCHANGE_IN" | "EXCHANGE_OUT" | "BET" | "PAYOUT" | "ADJUSTMENT";

export interface Agent {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  role: string;
  active: string;
}
