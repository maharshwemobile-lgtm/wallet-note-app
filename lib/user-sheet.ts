import { readSession } from "./auth";
import { getUserSpreadsheetId } from "./sheets";

export async function requireUserSheet() {
  const session = await readSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const spreadsheetId = await getUserSpreadsheetId(session.userId);
  if (!spreadsheetId) return { error: "Connect your Google Sheet first", status: 428 as const, session };
  return { session, spreadsheetId };
}
