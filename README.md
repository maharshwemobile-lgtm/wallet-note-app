# Wallet Note

Agent dashboard for dual-currency wallet management, THB/MMK exchange, and 3D lottery records using Google Sheets as the primary database.

## Stack
- Next.js 15 / React 19 / TypeScript
- Tailwind CSS
- Google Sheets API via service account
- JWT cookie authentication

## 1. Create Google Sheet tabs
Create one Google Spreadsheet and add these exact sheet names and header rows.

### Agents
`id | username | passwordHash | name | role | active`

### WalletTransactions
`id | createdAt | agentId | type | currency | amount | signedAmount | status | referenceType | referenceId`

### ExchangeTransactions
`id | createdAt | agentId | customerName | fromCurrency | fromAmount | toCurrency | toAmount | rate | note`

### Bets
`id | createdAt | agentId | drawId | userId | userName | number | amount | currency | status`

### LotteryResults
`id | createdAt | drawId | winningNumber | source | createdBy`

### Settings
`key | value`

Recommended initial values:
- `THB_TO_MMK | 130`
- `LOTTERY_PAYOUT_MULTIPLIER | 500`

## 2. Google Cloud setup
1. Create a Google Cloud project.
2. Enable **Google Sheets API**.
3. Create a Service Account.
4. Create and download a JSON key.
5. Copy `client_email` and `private_key` to `.env.local`.
6. Share the Google Sheet with the service account email as **Editor**.

## 3. Environment
Copy `.env.example` to `.env.local` and fill values.

```bash
cp .env.example .env.local
```

## 4. Create first agent password hash
Run:

```bash
node -e "console.log(require('bcryptjs').hashSync('ChangeMe123!', 12))"
```

Add a row in `Agents`, for example:

`agent-001 | admin | <generated hash> | Main Agent | admin | TRUE`

## 5. Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Wallet behavior
- Approved wallet rows affect balances through `signedAmount`.
- Cash In / Cash Out requests are created as Pending.
- Exchange records credit the received currency and deduct the paid currency.
- Bets deduct wallet balance.
- Winning result generation credits payout to the wallet using the configured multiplier.

## Production notes
Google Sheets is suitable for small and medium agent workloads, but it is not a transactional database. For high concurrency:
- Add idempotency keys.
- Add a write queue or Google Apps Script LockService.
- Restrict service account permissions.
- Add admin approval APIs for pending Cash In/Out.
- Move authentication and ledger to PostgreSQL while retaining Google Sheets as reporting/export storage.

## 3D API placeholder
`app/api/lottery/result/route.ts` includes `fetchWinningNumberFromProvider()`. Set:

```env
LOTTERY_API_URL=https://provider.example/api/result
LOTTERY_API_KEY=your_key
```

Adapt the returned JSON field to your licensed API provider.
