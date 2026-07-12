"use client";

import { useState } from "react";
import ExchangeClient from "./exchange-client";
import WalletClient from "./wallet-client";

export default function MoneyClient({ initialTab = "wallet" }: { initialTab?: "wallet" | "exchange" }) {
  const [tab, setTab] = useState<"wallet" | "exchange">(initialTab);

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl bg-slate-200 p-1">
        <button
          type="button"
          onClick={() => setTab("wallet")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "wallet" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          Cash In / Out
        </button>
        <button
          type="button"
          onClick={() => setTab("exchange")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "exchange" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          Exchange
        </button>
      </div>

      {tab === "wallet" ? <WalletClient /> : <ExchangeClient />}
    </div>
  );
}
