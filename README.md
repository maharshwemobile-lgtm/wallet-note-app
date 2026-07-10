# Wallet Note — Multi-User Public App

Wallet Note is a public multi-user dashboard for THB/MMK wallet tracking, currency exchange and 3D lottery management. Google Sheets remains the primary database.

## Multi-user features
- Public registration and login with email or username
- Password hashing with bcrypt
- JWT HTTP-only session cookie
- Per-user wallet ledger and balance isolation
- Per-user exchange rate and 3D payout settings
- Per-user exchange history, bets and lottery results
- Admin-only user list with activate/suspend controls
- Duplicate email and username protection

## Required Google Sheet tabs
Create these exact tabs and headers:

- `Users`: `id,name,email,username,passwordHash,role,status,createdAt`
- `WalletTransactions`: `id,userId,createdAt,type,currency,amount,signedAmount,status,referenceType,referenceId`
- `ExchangeTransactions`: `id,userId,createdAt,customerName,fromCurrency,fromAmount,toCurrency,toAmount,rate,note`
- `Bets`: `id,userId,createdAt,drawId,customerId,customerName,number,amount,currency,status`
- `LotteryResults`: `id,userId,createdAt,drawId,winningNumber,source`
- `UserSettings`: `userId,thbToMmkRate,payoutMultiplier`
- `PasswordResetTokens`: `id,userId,tokenHash,expiresAt,usedAt,createdAt`

## First admin
Register normally, then change that user's `role` cell in the `Users` sheet from `user` to `admin`.

## Environment
Copy `.env.example` to `.env.production` or `.env.local` and configure Google Sheets credentials plus a long random `JWT_SECRET`.

## Run
```bash
npm install
npm run dev
```

## Data isolation rule
Every transactional query must filter by the authenticated `userId`. Admin endpoints require the `admin` role. Do not accept `userId` from browser request bodies for normal user operations.

## Production note
Google Sheets does not provide database transactions or strong row locking. For a high-volume public service, move identity, wallet ledger and settlements to PostgreSQL, while keeping Google Sheets for reporting or export.
