import { google } from "googleapis";

const SYSTEM_SHEET_ID = process.env.SYSTEM_GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_ID || "";

const USER_SHEET_TABS = [
  { title: "WalletTransactions", headers: ["id", "createdAt", "type", "currency", "amount", "signedAmount", "status", "referenceType", "referenceId"] },
  { title: "ExchangeTransactions", headers: ["id", "createdAt", "customerName", "fromCurrency", "fromAmount", "toCurrency", "toAmount", "rate", "note"] },
  { title: "Bets", headers: ["id", "createdAt", "drawId", "customerId", "customerName", "number", "amount", "currency", "status"] },
  { title: "LotteryResults", headers: ["id", "createdAt", "drawId", "winningNumber", "source"] },
  { title: "Settings", headers: ["key", "value"] },
  { title: "Wallets", headers: ["id", "createdAt", "name", "currency", "initialBalance", "status"] },
  { title: "Remittances", headers: ["id", "createdAt", "date", "action", "mode", "sourceWalletId", "targetWalletId", "sourceAmount", "rate", "targetAmount", "customerName", "note", "status"] },
  { title: "Debts", headers: ["id", "createdAt", "date", "type", "name", "currency", "amount", "walletId", "note", "status"] },
  { title: "LotteryEntries", headers: ["id", "createdAt", "date", "type", "currency", "walletId", "number", "betAmount", "odds", "status"] },
] as const;

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Google service account environment variables are missing");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export function getSystemSpreadsheetId() {
  if (!SYSTEM_SHEET_ID) throw new Error("SYSTEM_GOOGLE_SHEET_ID is missing");
  return SYSTEM_SHEET_ID;
}

export async function readRows(range: string, spreadsheetId = getSystemSpreadsheetId()): Promise<string[][]> {
  const res = await getSheetsClient().spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as string[][] | undefined) ?? [];
}

export async function appendRow(range: string, values: (string | number)[], spreadsheetId = getSystemSpreadsheetId()) {
  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

export async function updateRange(range: string, values: (string | number)[][], spreadsheetId = getSystemSpreadsheetId()) {
  await getSheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function getObjectRows(sheetName: string, spreadsheetId = getSystemSpreadsheetId()): Promise<Record<string, string>[]> {
  const rows = await readRows(`${sheetName}!A:Z`, spreadsheetId);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows
    .slice(1)
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

export async function findRowIndex(sheetName: string, columnName: string, value: string, spreadsheetId = getSystemSpreadsheetId()) {
  const rows = await readRows(`${sheetName}!A:Z`, spreadsheetId);
  const header = rows[0] ?? [];
  const columnIndex = header.indexOf(columnName);
  if (columnIndex < 0) return -1;
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[columnIndex] === value);
  return rowIndex < 0 ? -1 : rowIndex + 1;
}

export function extractSpreadsheetId(input: string) {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const candidate = urlMatch?.[1] ?? trimmed;
  if (!/^[a-zA-Z0-9_-]{20,}$/.test(candidate)) throw new Error("Invalid Google Sheet URL or ID");
  return candidate;
}

export async function ensureUserSpreadsheetTabs(spreadsheetId: string) {
  const client = getSheetsClient();
  const metadata = await client.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties.title",
  });
  const existingTitles = new Set((metadata.data.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean) as string[]);
  const requests = USER_SHEET_TABS
    .filter((tab) => !existingTitles.has(tab.title))
    .map((tab) => ({ addSheet: { properties: { title: tab.title } } }));

  if (requests.length > 0) {
    await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  for (const tab of USER_SHEET_TABS) {
    const headerRows = await readRows(`${tab.title}!1:1`, spreadsheetId);
    const current = headerRows[0] ?? [];
    if (current.length === 0) {
      await updateRange(`${tab.title}!A1:${columnLetter(tab.headers.length)}1`, [[...tab.headers]], spreadsheetId);
    } else if (current.slice(0, tab.headers.length).join("|") !== tab.headers.join("|")) {
      throw new Error(`${tab.title} header does not match Wallet Note template`);
    }
  }

  const settings = await readRows("Settings!A:B", spreadsheetId);
  if (settings.length <= 1) {
    await updateRange("Settings!A1:B3", [
      ["key", "value"],
      ["THB_TO_MMK", 0],
      ["LOTTERY_PAYOUT_MULTIPLIER", 500],
    ], spreadsheetId);
  }

  return metadata.data.properties?.title ?? "Google Sheet";
}

export async function initializeUserSpreadsheet(spreadsheetId: string) {
  return ensureUserSpreadsheetTabs(spreadsheetId);
}

export async function getUserSpreadsheetId(userId: string) {
  const users = await getObjectRows("Users");
  return users.find((user) => user.id === userId)?.spreadsheetId?.trim() || null;
}

export async function setUserSpreadsheetConnection(userId: string, spreadsheetId: string) {
  const rows = await readRows("Users!A:Z");
  const headers = rows[0] ?? [];
  const idColumn = headers.indexOf("id");
  const spreadsheetColumn = headers.indexOf("spreadsheetId");
  const connectedAtColumn = headers.indexOf("sheetConnectedAt");
  if (idColumn < 0 || spreadsheetColumn < 0 || connectedAtColumn < 0) {
    throw new Error("Users sheet is missing spreadsheetId or sheetConnectedAt columns");
  }
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[idColumn] === userId);
  if (rowIndex < 0) throw new Error("User not found");
  const sheetRow = rowIndex + 1;
  await updateRange(`Users!${columnLetter(spreadsheetColumn + 1)}${sheetRow}`, [[spreadsheetId]]);
  await updateRange(`Users!${columnLetter(connectedAtColumn + 1)}${sheetRow}`, [[spreadsheetId ? new Date().toISOString() : ""]]);
}

function columnLetter(columnNumber: number) {
  let value = columnNumber;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}
