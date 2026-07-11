import PublicBetClient from "@/components/public-bet-client";

export default async function BetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicBetClient token={token} />;
}
