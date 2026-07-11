import { NextResponse } from "next/server";
import { WALLET_NOTE_LOGO_URL } from "@/lib/brand";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.redirect(WALLET_NOTE_LOGO_URL, {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
