import { google } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

function auth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!spreadsheetId || !email || !key) throw new Error("Google Sheets environment variables are missing");
  return new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

const sheets = google.sheets({ version: "v4", auth: auth() });

export async function readRows(range: string): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as string[][] | undefined) ?? [];
}

export async function appendRow(range: string, values: (string | number)[]) {
  await sheets.spreadsheets.values.append({ spreadsheetId, range, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [values] } });
}

export async function updateRange(range: string, values: (string | number)[][]) {
  await sheets.spreadsheets.values.update({ spreadsheetId, range, valueInputOption: "USER_ENTERED", requestBody: { values } });
}

export async function getObjectRows(sheetName: string): Promise<Record<string, string>[]> {
  const rows = await readRows(`${sheetName}!A:Z`);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r.some(Boolean)).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
}

export async function findRowIndex(sheetName: string, columnName: string, value: string) {
  const rows = await readRows(`${sheetName}!A:Z`);
  const header = rows[0] ?? [];
  const columnIndex = header.indexOf(columnName);
  if (columnIndex < 0) return -1;
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[columnIndex] === value);
  return rowIndex < 0 ? -1 : rowIndex + 1;
}

export async function getSetting(key: string, fallback = "") {
  const settings = await getObjectRows("Settings");
  return settings.find(s => s.key === key)?.value ?? fallback;
}
