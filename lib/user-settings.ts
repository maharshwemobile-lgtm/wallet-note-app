import { appendRow, getObjectRows, readRows, updateRange } from "./sheets";

export async function getUserSettings(userId: string) {
  const rows = await getObjectRows("UserSettings");
  const row = rows.find(r => r.userId === userId);
  return { thbToMmkRate: Number(row?.thbToMmkRate || 0), payoutMultiplier: Number(row?.payoutMultiplier || 500) };
}

export async function saveUserSettings(userId: string, rate: number, multiplier: number) {
  const rows = await readRows("UserSettings!A:C");
  const index = rows.findIndex((r, i) => i > 0 && r[0] === userId);
  if (index >= 0) await updateRange(`UserSettings!A${index + 1}:C${index + 1}`, [[userId, rate, multiplier]]);
  else await appendRow("UserSettings!A:C", [userId, rate, multiplier]);
}
