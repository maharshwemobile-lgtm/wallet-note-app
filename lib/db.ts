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
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

if (process.env.NODE_ENV !== "production") globalForDb.walletNotePool = db;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  await ensureSchema();
  return db.query<T>(text, values);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureSchema() {
  if (!globalForDb.walletNoteSchema) {
    globalForDb.walletNoteSchema = db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        username text NOT NULL UNIQUE,
        password_hash text NOT NULL DEFAULT '',
        role text NOT NULL DEFAULT 'user',
        status text NOT NULL DEFAULT 'Active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL,
        currency text NOT NULL CHECK (currency IN ('MMK','THB')),
        initial_balance numeric(18,2) NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'Active',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS remittances (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tx_date date NOT NULL,
        action text NOT NULL,
        mode text NOT NULL,
        source_wallet_id uuid REFERENCES wallets(id),
        target_wallet_id uuid REFERENCES wallets(id),
        source_amount numeric(18,2) NOT NULL,
        rate numeric(18,6) NOT NULL,
        target_amount numeric(18,2) NOT NULL,
        customer_name text NOT NULL,
        note text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'Active',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS debts (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tx_date date NOT NULL,
        debt_type text NOT NULL CHECK (debt_type IN ('receivable','payable')),
        name text NOT NULL,
        currency text NOT NULL CHECK (currency IN ('MMK','THB')),
        amount numeric(18,2) NOT NULL,
        wallet_id uuid REFERENCES wallets(id),
        note text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'unpaid',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lottery_entries (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        draw_date date NOT NULL,
        lottery_type text NOT NULL CHECK (lottery_type IN ('2D','3D','Other')),
        currency text NOT NULL CHECK (currency IN ('MMK','THB')),
        number text NOT NULL,
        customer_name text NOT NULL DEFAULT '',
        bet_amount numeric(18,2) NOT NULL,
        payout_multiplier numeric(18,2) NOT NULL DEFAULT 0,
        note text NOT NULL DEFAULT '',
        dealer_status text NOT NULL DEFAULT 'pending',
        dealer_wallet_id uuid REFERENCES wallets(id),
        dealer_settled_at timestamptz,
        result_status text NOT NULL DEFAULT 'pending',
        payout_amount numeric(18,2) NOT NULL DEFAULT 0,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lottery_results (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        draw_date date NOT NULL,
        lottery_type text NOT NULL,
        winning_number text NOT NULL,
        currency text NOT NULL CHECK (currency IN ('MMK','THB')),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id, draw_date, lottery_type, currency)
      );

      CREATE TABLE IF NOT EXISTS wallet_ledger (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        amount numeric(18,2) NOT NULL,
        entry_type text NOT NULL,
        reference_type text NOT NULL,
        reference_id uuid,
        note text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_remittances_user_date ON remittances(user_id, tx_date DESC);
      CREATE INDEX IF NOT EXISTS idx_debts_user_date ON debts(user_id, tx_date DESC);
      CREATE INDEX IF NOT EXISTS idx_lottery_entries_user_draw ON lottery_entries(user_id, draw_date DESC, lottery_type, number);
      CREATE INDEX IF NOT EXISTS idx_lottery_results_user_draw ON lottery_results(user_id, draw_date DESC);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet ON wallet_ledger(wallet_id, created_at DESC);
    `).then(() => undefined).catch((error) => {
      globalForDb.walletNoteSchema = undefined;
      throw error;
    });
  }
  return globalForDb.walletNoteSchema;
}
