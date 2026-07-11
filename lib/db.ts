import { Pool, PoolClient, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const globalForDb = globalThis as unknown as {
  walletNotePool?: Pool;
  walletNoteSchema?: Promise<void>;
};

export const db = globalForDb.walletNotePool ?? new Pool({
  connectionString,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 