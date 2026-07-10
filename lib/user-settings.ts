import { appendRow, getObjectRows, readRows, updateRange } from "./sheets";

export async function getUserSettings(spreadsheetId: string) {
  const rows = await getObjectRows("Settings", spreadsheetId);
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    thbToMmkRate: Number(map.THB_TO_MMK || 0),
    payoutMultiplier: Number(map.LOTTERY_PAYOUT_MULTIPLIER || 500),
  };
}

export async function saveUserSettings(spreadsheetId: string, rate: number, multiplier: number) {
  const rows = await readRows("Settings!A:B", spreadsheetId);
  await upsertSetting(rows, spreadsheetId, "THB_TO_MMK", rate);
  await upsertSetting(rows, spreadsheetId, "LOTTERY_PAYOUT_MULTIPLIER", multiplier);
}

async function upsertSetting(rows: string[][], spreadsheetId: string, key: string, value: number) {
  const index = rows.findIndex((row, rowIndex) => rowIndex > 0 && row[0] === key);
  if (index >= 0) {
    await updateRange(`Settings!B${index + 1}`, [[value]], spreadsheetId);
  } else {
    await appendRow("Settings!A:B", [key, value], spreadsheetId);
  }
}
