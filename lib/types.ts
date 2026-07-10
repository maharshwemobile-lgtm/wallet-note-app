export type Currency = "THB" | "MMK";
export type TxStatus = "Pending" | "Approved" | "Rejected";
export type WalletTxType = "CASH_IN" | "CASH_OUT" | "EXCHANGE_IN" | "EXCHANGE_OUT" | "BET" | "PAYOUT" | "ADJUSTMENT";
export type UserRole = "user" | "admin";
export type UserStatus = "Active" | "Suspended";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}
