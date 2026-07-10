import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import {
  extractSpreadsheetId,
  getObjectRows,
  initializeUserSpreadsheet,
  setUserSpreadsheetConnection,
} from "@/lib/sheets";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await getObjectRows("Users");
  const user = users.find((row) => row.id === session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const spreadsheetId = user.spreadsheetId?.trim() || "";
  return NextResponse.json({
    connected: Boolean(spreadsheetId),
    spreadsheetId,
    spreadsheetUrl: spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : "",
    connectedAt: user.sheetConnectedAt || "",
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ sheet: z.string().min(20).max(500) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid Google Sheet URL or ID" }, { status: 400 });

  try {
    const spreadsheetId = extractSpreadsheetId(parsed.data.sheet);
    const title = await initializeUserSpreadsheet(spreadsheetId);
    await setUserSpreadsheetConnection(session.userId, spreadsheetId);
    return NextResponse.json({
      ok: true,
      title,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to connect Google Sheet";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await setUserSpreadsheetConnection(session.userId, "");
  return NextResponse.json({ ok: true });
}
