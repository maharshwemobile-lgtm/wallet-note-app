"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ArrowUpRight, CircleCheck, Dices, HandCoins, WalletCards } from "lucide-react";

type Wallet = {
  id: string;
  name: string;
  currency: "MMK" | "THB";
  balance: number;
  initialBalance: number;
};

type RecordRow = Record<string, string>;

type DashboardData = {
  storage: {
    provider: string;
    connected: boolean;
    spreadsheetTitle: string;
  };
  wallets: Wallet[];
  remittances: RecordRow[];
  debts: RecordRow[];
  lotteries: RecordRow[];
  debtSummary: {
    receivable: { MMK: number; THB: number };
    payable: { MMK: number; THB: number };
  };
  lotterySummary: {
    total: { MMK: number; THB: number };
    pending: { MMK: number; THB: number };
    settled: { MMK: number; THB: number };
  };
};

const money = (value: string | number, currency?: string) =>
  `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/premium", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Dashboard ဖွင့်မရပါ");
        return json as DashboardData;
      })
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Dashboard ဖွင့်မရပါ"));
  }, []);

  const totals = useMemo(() => {
    const result = { MMK: 0, THB: 0 };
    for (const wallet of data?.wallets ?? []) result[wallet.currency] += Number(wallet.balance || 0);
    return result;
  }, [data]);

  const walletName = (id: string) => data?.wallets.find((wallet) => wallet.id === id)?.name || "Wallet";

  if (error) return <div className="card border-red-200 bg-red-50 text-red-700">{error}</div>;
  if (!data) return <div className="card">Dashboard စာရင်းများ ဖွင့်နေပါသည်...</div>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      <div className="flex items-center gap-2"><CircleCheck size={18}/><span>Google Sheet ချိတ်ဆက်ထားသည် — {data.storage.spreadsheetTitle}</span></div>
      <span className="text-xs font-bold">{data.storage.provider}</span>
    </div>

    <section className="grid gap-3 grid-cols-2 xl:grid-cols-4">
      <QuickLink href="/accounts" title="ငွေစာရင်းအကောင့်များ" subtitle={`${data.wallets.length} Wallet`} icon={<WalletCards size={22}/>} />
      <QuickLink href="/remittance" title="ငွေလွှဲ/ငွေထုတ်" subtitle={`${data.remittances.length} မှတ်တမ်း`} icon={<ArrowLeftRight size={22}/>} />
      <QuickLink href="/debts" title="အကြွေးစာရင်း" subtitle={`${data.debts.length} မှတ်တမ်း`} icon={<HandCoins size={22}/>} />
      <QuickLink href="/lottery" title="ချဲစာရင်း 2D/3D" subtitle={`${data.lotteries.length} မှတ်တမ်း`} icon={<Dices size={22}/>} />
    </section>

    <section className="grid gap-3 grid-cols-2 xl:grid-cols-6">
      <Summary label="Wallet စုစုပေါင်း MMK" value={totals.MMK} currency="MMK" tone="dark" />
      <Summary label="Wallet စုစုပေါင်း THB" value={totals.THB} currency="THB" tone="dark" />
      <Summary label="ရရန်ရှိ MMK" value={data.debtSummary.receivable.MMK} currency="MMK" tone="emerald" />
      <Summary label="ရရန်ရှိ THB" value={data.debtSummary.receivable.THB} currency="THB" tone="emerald" />
      <Summary label="ပေးရန်ရှိ MMK" value={data.debtSummary.payable.MMK} currency="MMK" tone="rose" />
      <Summary label="ပေးရန်ရှိ THB" value={data.debtSummary.payable.THB} currency="THB" tone="rose" />
    </section>

    <section className="card">
      <SectionHeader title="ငွေစာရင်းအကောင့်များ" href="/accounts" />
      {data.wallets.length === 0 ? <Empty text="Wallet မရှိသေးပါ။" /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.wallets.slice(0, 8).map((wallet) => <div key={wallet.id} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="absolute -bottom-4 -right-1 text-6xl font-black text-slate-200/60">{wallet.currency === "MMK" ? "Ks" : "฿"}</div>
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">{wallet.currency}</span>
          <p className="mt-3 font-bold text-slate-800">{wallet.name}</p>
          <p className={`relative mt-3 text-xl font-black ${wallet.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{money(wallet.balance, wallet.currency)}</p>
        </div>)}
      </div>}
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <div className="card">
        <SectionHeader title="နောက်ဆုံး ငွေလွှဲမှတ်တမ်း" href="/remittance" />
        <div className="space-y-3">
          {data.remittances.slice(0, 6).map((row) => <div key={row.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-semibold">{row.customerName}</p><p className="text-xs text-slate-400">{row.date}</p></div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{row.mode === "thb-mmk" ? "THB → MMK" : "MMK → THB"}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">{walletName(row.sourceWalletId)} → {walletName(row.targetWalletId)}</span>
              <span className="font-bold text-emerald-600">{money(row.targetAmount)}</span>
            </div>
          </div>)}
          {data.remittances.length === 0 && <Empty text="ငွေလွှဲမှတ်တမ်း မရှိသေးပါ။" />}
        </div>
      </div>

      <div className="card">
        <SectionHeader title="အကြွေးမှတ်တမ်း" href="/debts" />
        <div className="space-y-3">
          {data.debts.slice(0, 6).map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div className="min-w-0"><p className="truncate font-semibold">{row.name}</p><p className="text-xs text-slate-400">{row.date} · {row.type === "receivable" ? "ရရန်ရှိ" : "ပေးရန်ရှိ"}</p></div>
            <div className="text-right"><p className="font-bold">{money(row.amount, row.currency)}</p><span className={`text-[10px] font-bold ${row.status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>{row.status === "paid" ? "ဆပ်ပြီး" : "မဆပ်ရသေး"}</span></div>
          </div>)}
          {data.debts.length === 0 && <Empty text="အကြွေးမှတ်တမ်း မရှိသေးပါ။" />}
        </div>
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="card">
        <SectionHeader title="ချဲ Agent စာရင်းချုပ်" href="/lottery" />
        <div className="grid gap-3 grid-cols-2">
          <Mini label="ဒိုင်ရှင်းရန် MMK" value={money(data.lotterySummary.pending.MMK, "MMK")} danger />
          <Mini label="ဒိုင်ရှင်းရန် THB" value={money(data.lotterySummary.pending.THB, "THB")} danger />
          <Mini label="ရှင်းပြီး MMK" value={money(data.lotterySummary.settled.MMK, "MMK")} accent />
          <Mini label="ရှင်းပြီး THB" value={money(data.lotterySummary.settled.THB, "THB")} accent />
        </div>
      </div>

      <div className="card">
        <SectionHeader title="နောက်ဆုံး ချဲမှတ်တမ်း" href="/lottery" />
        <div className="grid gap-3 sm:grid-cols-2">
          {data.lotteries.slice(0, 6).map((row) => <div key={row.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{row.type}</span><span className={`text-[10px] font-bold ${row.status === "settled" ? "text-emerald-600" : "text-amber-600"}`}>{row.status === "settled" ? "ရှင်းပြီး" : "ဒိုင်ရှင်းရန်"}</span></div>
            <p className="mt-2 font-mono text-2xl font-black tracking-widest">{row.number}</p>
            <div className="mt-2 flex justify-between text-xs"><span className="text-slate-400">{row.date}</span><span className="font-bold">{money(row.betAmount, row.currency)}</span></div>
          </div>)}
          {data.lotteries.length === 0 && <Empty text="ချဲမှတ်တမ်း မရှိသေးပါ။" />}
        </div>
      </div>
    </section>
  </div>;
}

function QuickLink({ href, title, subtitle, icon }: { href: string; title: string; subtitle: string; icon: React.ReactNode }) {
  return <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-slate-950 p-2.5 text-white">{icon}</span><ArrowUpRight size={18} className="text-slate-300 transition group-hover:text-slate-700" /></div>
    <p className="mt-4 font-bold">{title}</p><p className="mt-1 text-xs text-slate-500">{subtitle}</p>
  </Link>;
}

function Summary({ label, value, currency, tone }: { label: string; value: number; currency: string; tone: "dark" | "emerald" | "rose" }) {
  const style = tone === "dark" ? "border-slate-900 bg-slate-950 text-white" : tone === "emerald" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800";
  return <div className={`rounded-2xl border p-4 ${style}`}><p className="text-[10px] font-bold opacity-70 sm:text-xs">{label}</p><p className="mt-2 text-base font-black sm:text-xl">{money(value, currency)}</p></div>;
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4"><h2 className="font-bold">{title}</h2><Link href={href} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900">အားလုံးကြည့်မည် <ArrowUpRight size={14}/></Link></div>;
}

function Mini({ label, value, accent = false, danger = false }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  const style = danger ? "bg-rose-50 text-rose-700" : accent ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700";
  return <div className={`rounded-xl p-3 ${style}`}><p className="text-[10px] font-bold opacity-70">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="col-span-full rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">{text}</div>;
}
