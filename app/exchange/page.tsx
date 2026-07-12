import Shell from "@/components/shell";
import MoneyClient from "@/components/money-client";

export default function Page() {
  return (
    <Shell title="Wallet">
      <MoneyClient initialTab="exchange" />
    </Shell>
  );
}
