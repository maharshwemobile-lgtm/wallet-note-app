# Wallet Note — Public Multi-User App with Individual Google Sheets

Wallet Note lets each registered user connect and use their own Google Sheet. The application keeps only account records and the connected spreadsheet ID in one central system sheet. Wallet, exchange and lottery data stay inside each user's Google Drive spreadsheet.

## How it works
1. A user registers and signs in.
2. The user creates a blank Google Sheet.
3. The user shares that sheet as **Editor** with `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
4. The user pastes the Google Sheet URL into **My Google Sheet**.
5. Wallet Note verifies access and automatically creates the required tabs and headers.
6. All dashboard, wallet, exchange, 3D bets, results and settings requests use only that connected sheet.

Users never upload a service-account private key. The private key stays on the VPS.

## Central system sheet
Set `SYSTEM_GOOGLE_SHEET_ID` to a private spreadsheet shared only with the app service account. Create these tabs:

- `Users`: `id,name,email,username,passwordHash,role,status,spreadsheetId,sheetConnectedAt,createdAt`
- `PasswordResetTokens`: `id,userId,tokenHash,expiresAt,usedAt,createdAt`

## Each user's sheet
The app automatically creates and validates:

- `WalletTransactions`: `id,createdAt,type,currency,amount,signedAmount,status,referenceType,referenceId`
- `ExchangeTransactions`: `id,createdAt,customerName,fromCurrency,fromAmount,toCurrency,toAmount,rate,note`
- `Bets`: `id,createdAt,drawId,customerId,customerName,number,amount,currency,status`
- `LotteryResults`: `id,createdAt,drawId,winningNumber,source`
- `Settings`: `key,value`

Default settings are `THB_TO_MMK=0` and `LOTTERY_PAYOUT_MULTIPLIER=500`.

## Environment
```env
SYSTEM_GOOGLE_SHEET_ID=central_users_registry_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=wallet-note@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
JWT_SECRET=replace_with_a_long_random_secret
NEXT_PUBLIC_APP_NAME=Wallet Note
LOTTERY_API_URL=
LOTTERY_API_KEY=
```

## First admin
Register normally, then change that user's `role` cell in the central `Users` tab from `user` to `admin`.

## Security model
- User identity and status are checked from the central system sheet.
- Normal APIs never accept a spreadsheet ID from the browser.
- The server resolves the connected spreadsheet using the authenticated session user ID.
- Users must explicitly share their spreadsheet with the service account.
- Disconnecting removes only the stored connection ID; it does not delete their Google Sheet or data.

## Production limitation
Google Sheets is suitable for small and medium personal ledgers, but it does not provide database transactions, strong locking or high-volume concurrency. Use PostgreSQL for payments, settlements or high-volume financial workloads.
