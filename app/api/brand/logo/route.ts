import { WALLET_NOTE_LOGO_URL } from "@/lib/brand";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(WALLET_NOTE_LOGO_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Wallet-Note-App" },
    });

    if (!response.ok) {
      return new Response("Logo unavailable", { status: 502 });
    }

    const body = await response.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Logo unavailable", { status: 502 });
  }
}
