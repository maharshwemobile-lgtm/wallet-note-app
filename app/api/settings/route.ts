import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserSettings, saveUserSettings } from "@/lib/user-settings";
import { requireUserSheet } from "@/lib/user-sheet";

export async function GET() {
  const access = await requireUserSheet();
  if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
  return NextResponse.json(await getUserSettings(access.spreadsheetId));
}

export async function POST(req: Request) {
  const access = await requireUserSheet();
  if ("error" in access) return NextResponse.json({ error: access.error, needsSheet: access.status === 428 }, { status: access.status });
  const parsed = z.object({ rate: z.number().positive(), multiplier: z.number().positive().max(100000) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  await saveUserSettings(access.spreadsheetId, parsed.data.rate, parsed.data.multiplier);
  return NextResponse.json({ ok: true });
}
