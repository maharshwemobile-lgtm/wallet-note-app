"use client";

import Link from "next/link";
import { ArrowLeftRight, Dices, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

export default function DashboardClient() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(100);
  const [side, setSide] = useState<"THB" | "MMK">("THB");

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load dashboard");
        setData(body);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="card max-w-xl space-y-3 text-center">
        <p className="text-lg font-semibold">Setup needed</p>
        <p className="text-sm text-slate-500">{error}</p>
        <Link href="/settings" className="btn-primary inline-block">Open Settings</Link>
      </div>
    );
  }

  if (!data) return <div className="card">Loading...</div>;

  const rate = Number(data.rate || 0);
  const converted = rate > 0 ? (side === "THB" ? amount * rate : amount / rate) : 0;
  const recent = Array.isArray(data.recent) ? data.recent.slice(0, 5) : [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-sm font-medium text-slate-500">THB balance</p>
          <p className="mt-2 text-3xl font-bold">฿ {Number(data.balances?.THB || 0).toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-slate-500">MMK balance</p>
          <p className="mt-2 text-3xl font-bold">K {Number(data.balances?.MMK || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link href="/wallet" className="card flex flex-col items-center gap-2 p-4 text-center font-semibold transition hover:border-slate-400">
          <WalletCards size={24} />
          Money in/out
        </Link>
        <Link href="/exchange" className="card flex flex-col items-center gap-2 p-4 text-center font-semibold transition hover:border-slate-400">
          <ArrowLeftRight size={24} />
          Exchange
        </Link>
        <Link href="/lottery" className="card flex flex-col items-center gap-2 p-4 text-center font-semibold transition hover:border-slate-400">
          <Dices size={24} />
          Add 3D
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Quick calculator</h2>
            <span className="text-sm text-slate-500">1 THB = {rate.toLocaleString()} MMK</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <select className="field" value={side} onChange={(e) => setSide(e.target.value as "THB" | "MMK")}> 
              <option value="THB">THB</option>
              <option value="MMK">MMK</option>
            </select>
            <input className="field" type="number" min="0" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="mt-3 rounded-xl bg-slate-100 p-4 text-xl font-bold">
            {side === "THB" ? "MMK" : "THB"}: {Number.isFinite(converted) ? converted.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 0}
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <Link href="/wallet" className="text-sm font-medium text-slate-600 hover:text-slate-900">View all</Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {recent.map((row: any) => (
                <div key={row.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{String(row.type || "Transaction").replaceAll("_", " ")}</p>
                    <p className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</p>
                  </div>
                  <p className={Number(row.signedAmount) >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                    {row.currency} {Number(row.signedAmount || 0).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
