import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { extractSpreadsheetId } from "@/lib/sheets";

async function requireUser() {
  const session = await readSession();
  return session || null;
}

async function getSettings(userId: string) {
  await query(
    `INSERT INTO app_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  const result = await query(
    `SELECT thb_to_mmk_rate, default_lottery_multiplier, google_sheet_id, google_sheet_connected_at, google_sheet_backup_enabled, updated_at FROM app_settings WHERE user_id=$1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    thbToMmkRate: Number(row.thb_to_mmk_rate || 0),
    defaultLotteryMultiplier: Number(row.default_lottery_multiplier || 80),
    googleSheetId: row.google_sheet_id || "",
    googleSheetUrl: row.google_sheet_id ? `https://docs.google.com/spreadsheets/d/${row.google_sheet_id}/edit` : "",
    googleSheetConnected: Boolean(row.google_sheet_id),
    googleSheetConnectedAt: row.google_sheet_connected_at || "",
    googleSheetBackupEnabled: Boolean(row.google_sheet_backup_enabled),
    updatedAt: row.updated_at,
    storage: "PostgreSQL Main Database",
    note: "Google Sheet is optional backup/export only. Core app does not require it.",
  };
}

export async function GET() {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getSettings(session.userId));
}

export async function POST(req: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({
    rate: z.number().min(0).optional(),
    multiplier: z.number().positive().max(100000).optional(),
    sheet: z.string().max(500).optional(),
    backupEnabled: z.boolean().optional(),
    disconnectSheet: z.boolean().optional(),
  }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });

  let sheetId: string | null | undefined;
  if (parsed.data.disconnectSheet) sheetId = "";
  else if (parsed.data.sheet && parsed.data.sheet.trim()) sheetId = extractSpreadsheetId(parsed.data.sheet);

  await query(`INSERT INTO app_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [session.userId]);
  await query(
    `UPDATE app_settings SET
      thb_to_mmk_rate=COALESCE($2, thb_to_mmk_rate),
      default_lottery_multiplier=COALESCE($3, default_lottery_multiplier),
      google_sheet_id=COALESCE($4, google_sheet_id),
      google_sheet_connected_at=CASE WHEN $4 IS NULL THEN google_sheet_connected_at WHEN $4='' THEN NULL ELSE now() END,
      google_sheet_backup_enabled=COALESCE($5, google_sheet_backup_enabled),
      updated_at=now()
     WHERE user_id=$1`,
    [session.userId, parsed.data.rate ?? null, parsed.data.multiplier ?? null, sheetId, parsed.data.backupEnabled ?? null],
  );
  return NextResponse.json({ ok: true, settings: await getSettings(session.userId) });
}
