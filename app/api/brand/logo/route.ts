import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  try {
    const file = await readFile(path.join(process.cwd(), "app", "Wallet Note.png"));

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("Logo unavailable", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
