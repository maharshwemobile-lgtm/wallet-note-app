import { Pool, PoolClient, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const globalForDb = globalThis as unknown as { walletNotePool?: Pool; walletNoteSchema?: Promise<void> };

export const db = globalForDb.walletNotePool ?? new Pool({
  connectionString,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

if (process.env.NODE_ENV !== "production") globalForDb.walletNotePool = db;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  await ensureSchema();
  return db.query<T>(text, values);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
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

      ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS link_token text UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS link_enabled boolean NOT NULL DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS max_bet_per_number numeric(18,2) NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS max_bet_per_draw numeric(18,2) NOT NULL DEFAULT 0;

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
        rate numeric(18,6) NOT NULL DEFAULT 0,
        target_amount numeric(18,2) NOT NULL DEFAULT 0,
        customer_name text NOT NULL,
        note text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'Active',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE remittances ADD COLUMN IF NOT EXISTS fee_amount numeric(18,2) NOT NULL DEFAULT 0;
      ALTER TABLE remittances ADD COLUMN IF NOT EXISTS total_amount numeric(18,2) NOT NULL DEFAULT 0;
      ALTER TABLE remittances ADD COLUMN IF NOT EXISTS transfer_method text NOT NULL DEFAULT 'Cash';
      ALTER TABLE remittances ADD COLUMN IF NOT EXISTS status_detail text NOT NULL DEFAULT '';
      ALTER TABLE remittances ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

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
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS principal_amount numeric(18,2);
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS interest_mode text NOT NULL DEFAULT 'none';
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS interest_label text NOT NULL DEFAULT '';
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS interest_value numeric(18,4) NOT NULL DEFAULT 0;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS repayment_plan text NOT NULL DEFAULT 'one-time';
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS start_date date;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS due_date date;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS installment_amount numeric(18,2) NOT NULL DEFAULT 0;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS paid_amount numeric(18,2) NOT NULL DEFAULT 0;
      UPDATE debts SET principal_amount=amount WHERE principal_amount IS NULL;

      CREATE TABLE IF NOT EXISTS debt_payments (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        debt_id uuid NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
        wallet_id uuid REFERENCES wallets(id),
        amount numeric(18,2) NOT NULL,
        paid_at timestamptz NOT NULL DEFAULT now(),
        note text NOT NULL DEFAULT ''
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
      ALTER TABLE lottery_entries ADD COLUMN IF NOT EXISTS cycle_key text NOT NULL DEFAULT '';
      ALTER TABLE lottery_entries ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'cash_paid';
      ALTER TABLE lottery_entries ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'unpaid';
      ALTER TABLE lottery_entries ADD COLUMN IF NOT EXISTS source_end_user_id uuid REFERENCES users(id);
      ALTER TABLE lottery_entries ADD COLUMN IF NOT EXISTS lottery_debt_id uuid REFERENCES debts(id);
      UPDATE lottery_entries SET cycle_key = to_char(draw_date, 'YYYY-MM-DD') WHERE cycle_key = '';

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

      CREATE TABLE IF NOT EXISTS lottery_dealer_settlements (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        draw_date date NOT NULL,
        lottery_type text NOT NULL,
        currency text NOT NULL CHECK (currency IN ('MMK','THB')),
        wallet_id uuid NOT NULL REFERENCES wallets(id),
        gross_amount numeric(18,2) NOT NULL DEFAULT 0,
        commission_mode text NOT NULL DEFAULT 'none',
        commission_value numeric(18,4) NOT NULL DEFAULT 0,
        commission_amount numeric(18,2) NOT NULL DEFAULT 0,
        net_amount numeric(18,2) NOT NULL DEFAULT 0,
        entry_count integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
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

      CREATE TABLE IF NOT EXISTS app_settings (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        thb_to_mmk_rate numeric(18,6) NOT NULL DEFAULT 0,
        default_lottery_multiplier numeric(18,2) NOT NULL DEFAULT 80,
        google_sheet_id text NOT NULL DEFAULT '',
        google_sheet_connected_at timestamptz,
        google_sheet_backup_enabled boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_users_owner ON users(owner_id);
      CREATE INDEX IF NOT EXISTS idx_users_link_token ON users(link_token);
      CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_remittances_user_date ON remittances(user_id, tx_date DESC);
      CREATE INDEX IF NOT EXISTS idx_debts_user_date ON debts(user_id, tx_date DESC);
      CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id, paid_at DESC);
      CREATE INDEX IF NOT EXISTS idx_lottery_entries_user_draw ON lottery_entries(user_id, draw_date DESC, lottery_type, number);
      CREATE INDEX IF NOT EXISTS idx_lottery_results_user_draw ON lottery_results(user_id, draw_date DESC);
      CREATE INDEX IF NOT EXISTS idx_lottery_settlements_user_draw ON lottery_dealer_settlements(user_id, draw_date DESC, lottery_type);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet ON wallet_ledger(wallet_id, created_at DESC);
    `).then(() => undefined).catch((error) => {
      globalForDb.walletNoteSchema = undefined;
      throw error;
    });
  }
  return globalForDb.walletNoteSchema;
}
