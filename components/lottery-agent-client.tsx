"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CircleCheck, Trophy, WalletCards } from "lucide-react";

type Row = Record<string, any>;
type Wallet = { id: string; name: string; currency: "MMK" | "THB"; balance: number };
type Data = { storage: any; wallets: Wallet[]; lotteries: Row[]; winners: Row[]; results: Row[]; settlements: Row[]; lotterySummary: any };
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string | number, currency: string) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

export default function LotteryAgentClient() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [latestWinners, setLatestWinners] = useState<Row[]>([]);
  const [currency, setCurrency] = useState<"MMK" | "THB">("MMK");

  async function load() {
    const response = await fetch("/api/premium", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "စာရင်းဖွင့်မရပါ");
    setData(json);
  }
  useEffect(() => { load().catch((e) => setMessage(e instanceof Error ? e.message : "စာရင်းဖွင့်မရပါ")); }, []);

  async function request(method: string, body: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/premium", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "မအောင်မြင်ပါ");
      if (Array.isArray(json.winners)) setLatestWinners(json.winners);
      await load();
      setMessage(`${json.sheet || "Lottery"} အောင်မြင်ပါပြီ။`);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "မအောင်မြင်ပါ");
      return false;
    } finally { setBusy(false); }
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const ok = await request("POST", { entity: "lottery", data: {
      date: form.get("date"), type: form.get("type"), currency: form.get("currency"), number: form.get("number"), customerName: form.get("customerName"), betAmount: Number(form.get("betAmount")), payoutMultiplier: Number(form.get("payoutMultiplier")), paymentStatus: form.get("paymentStatus"), note: form.get("note"),
    }});
    if (ok) event.currentTarget.reset();
  }
  async function submitSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await request("PATCH", { action: "settleLotteryDealer", date: form.get("date"), type: form.get("type"), currency: form.get("currency"), walletId: form.get("walletId"), commissionMode: form.get("commissionMode"), commissionValue: Number(form.get("commissionValue") || 0) });
  }
  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await request("POST", { entity: "lotteryResult", data: { date: form.get("date"), type: form.get("type"), currency: form.get("currency"), winningNumber: form.get("winningNumber") } });
  }

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of data?.lotteries ?? []) {
      const key = `${row.type} · ${row.currency} · ${row.cycleKey || row.date}`;
      map.set(key, [...(map.get(key) || []), row]);
    }
    return [...map.entries()].map(([key, rows]) => ({ key, rows, total: rows.reduce((s, r) => s + Number(r.betAmount || 0), 0), pending: rows.filter((r) => r.status !== "settled").reduce((s, r) => s + Number(r.betAmount || 0), 0) }));
  }, [data]);
  const winners = latestWinners.length > 0 ? latestWinners : (data?.winners ?? []);
  const lotteryWallets = data?.wallets.filter((wallet) => wallet.currency === currency) ?? [];

  if (!data) return <div className="card">ချဲစာရင်း ဖွင့်နေပါသည်...</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><div className="flex items-center gap-2"><CircleCheck size={18}/><span>PostgreSQL Main Database ချိတ်ဆက်ထားသည်</span></div><span className="text-xs font-bold">{data.storage.provider}</span></div>
    {message && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-6"><Summary label="စုစုပေါင်း MMK" value={data.lotterySummary.total.MMK} currency="MMK"/><Summary label="စုစုပေါင်း THB" value={data.lotterySummary.total.THB} currency="THB"/><Summary label="ဒိုင်ရှင်းရန် MMK" value={data.lotterySummary.pending.MMK} currency="MMK" tone="rose"/><Summary label="ဒိုင်ရှင်းရန် THB" value={data.lotterySummary.pending.THB} currency="THB" tone="rose"/><Summary label="မရော်သေး MMK" value={data.lotterySummary.unpaidPayout?.MMK || 0} currency="MMK" tone="emerald"/><Summary label="မရော်သေး THB" value={data.lotterySummary.unpaidPayout?.THB || 0} currency="THB" tone="emerald"/></section>

    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]"><div className="space-y-5">
      <form onSubmit={submitEntry} className="card grid gap-4"><div><h2 className="text-lg font-bold">ချဲမှတ်တမ်းအသစ်</h2><p className="text-xs text-slate-500">2D = Daily, 3D = Weekly cycle အလိုအလျောက် group လုပ်မည်</p></div><label className="form-label">ဖောက်သည်အမည်<input name="customerName" className="field mt-1" required /></label><div className="grid grid-cols-2 gap-3"><label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option>2D</option><option>3D</option><option>Other</option></select></label><label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label></div><label className="form-label">ချဲထွက်မည့်နေ့<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label><label className="form-label">ထိုးဂဏန်း<input name="number" inputMode="numeric" className="field mt-1 text-lg font-black tracking-widest" required /></label><div className="grid grid-cols-2 gap-3"><label className="form-label">ထိုးငွေ<input name="betAmount" type="number" min="1" step="any" className="field mt-1" required /></label><label className="form-label">ပေါက်ဆ<input name="payoutMultiplier" type="number" min="1" step="any" defaultValue="80" className="field mt-1" required /></label></div><label className="form-label">ငွေချေမှု<select name="paymentStatus" className="field mt-1"><option value="cash_paid">Cash paid</option><option value="wallet_paid">Wallet paid</option><option value="debt">ချဲကြွေး</option></select></label><label className="form-label">မှတ်ချက်<textarea name="note" className="field mt-1 min-h-20" /></label><button disabled={busy} className="btn-primary py-3">ချဲစာရင်း သိမ်းမည်</button></form>
      <form onSubmit={submitSettlement} className="card grid gap-4 border-amber-200 bg-amber-50/40"><div className="flex gap-3"><WalletCards className="text-amber-600"/><div><h2 className="font-bold">ချဲဒိုင်ကြီးကို ရှင်းမည်</h2><p className="text-xs text-slate-500">Gross - Commission = Net amount ကို wallet မှနုတ်မည်</p></div></div><label className="form-label">နေ့/အပတ်<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label><div className="grid grid-cols-2 gap-3"><label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option>2D</option><option>3D</option><option>Other</option></select></label><label className="form-label">ငွေကြေး<select name="currency" value={currency} onChange={(e)=>setCurrency(e.target.value as any)} className="field mt-1"><option>MMK</option><option>THB</option></select></label></div><label className="form-label">Wallet<select name="walletId" className="field mt-1" required><option value="">Wallet ရွေးပါ</option>{lotteryWallets.map((wallet)=><option key={wallet.id} value={wallet.id}>{wallet.name} — {money(wallet.balance,wallet.currency)}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="form-label">Commission<select name="commissionMode" className="field mt-1"><option value="none">မရှိ</option><option value="percent">Percent</option><option value="fixed">Fixed</option></select></label><label className="form-label">တန်ဖိုး<input name="commissionValue" type="number" min="0" step="any" className="field mt-1" defaultValue="0" /></label></div><button disabled={busy} className="rounded-xl bg-amber-500 px-4 py-3 font-bold text-slate-950">ဒိုင်ရှင်းမည်</button></form>
      <form onSubmit={submitResult} className="card grid gap-4 border-emerald-200 bg-emerald-50/40"><div className="flex gap-3"><Trophy className="text-emerald-600"/><div><h2 className="font-bold">ပေါက်ဂဏန်း ထည့်မည်</h2><p className="text-xs text-slate-500">Winner count / payout list ချက်ချင်းပြမည်</p></div></div><label className="form-label">နေ့/အပတ်<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label><div className="grid grid-cols-2 gap-3"><label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option>2D</option><option>3D</option><option>Other</option></select></label><label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label></div><label className="form-label">ပေါက်ဂဏန်း<input name="winningNumber" inputMode="numeric" className="field mt-1 text-xl font-black tracking-widest" required /></label><button disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">ပေါက်သူ စစ်မည်</button></form>
    </div>
    <section className="space-y-5"><div className="card"><h2 className="mb-3 font-bold">Cycle Cards</h2><div className="grid gap-3">{groups.map((group)=><article key={group.key} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{group.key}</p><p className="text-xs text-slate-400">{group.rows.length} records</p></div><div className="text-right"><p className="font-black">{money(group.total, group.rows[0]?.currency || "MMK")}</p><p className="text-xs text-amber-600">Pending {money(group.pending, group.rows[0]?.currency || "MMK")}</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{group.rows.slice(0,6).map((row)=><div key={row.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between"><span className="font-mono text-xl font-black">{row.number}</span><span className="text-xs">{row.paymentStatus === "debt" ? "ချဲကြွေး" : row.paymentStatus}</span></div><p className="text-sm">{row.customerName}</p><p className="text-xs text-slate-500">{money(row.betAmount,row.currency)} · {row.status === "settled" ? "ဒိုင်ရှင်းပြီး" : "ဒိုင်ရှင်းရန်"}</p></div>)}</div></article>)}</div></div>
      <div className="card"><h2 className="mb-3 font-bold">ပေါက်သူများ</h2>{winners.length === 0 ? <p className="text-sm text-slate-400">ပေါက်သူမရှိသေးပါ။</p> : <div className="space-y-3">{winners.map((row)=><article key={row.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{row.customerName}</p><p className="font-mono text-2xl font-black">{row.number}</p></div><div className="text-right"><p className="font-black text-emerald-700">{money(row.payoutAmount,row.currency)}</p><button className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700" onClick={()=>request("PATCH",{action:"updateWinnerPayout",id:row.id,payoutStatus:row.payoutStatus === "paid" ? "unpaid" : "paid"})}>{row.payoutStatus === "paid" ? "ရော်ပြီး" : "မရော်သေး"}</button></div></div></article>)}</div>}</div>
      <div className="card"><h2 className="mb-3 font-bold">ဒိုင်ရှင်း History</h2>{data.settlements?.map((row)=><div key={row.id} className="mb-2 rounded-xl bg-slate-50 p-3 text-sm"><b>{row.date} · {row.type}</b><br/>Gross {money(row.grossAmount,row.currency)} · Commission {money(row.commissionAmount,row.currency)} · Net {money(row.netAmount,row.currency)}</div>)}</div>
    </section></div>
  </div>;
}

function Summary({ label, value, currency, tone = "slate" }: { label: string; value: number; currency: string; tone?: "slate" | "rose" | "emerald" }) { const style = tone === "rose" ? "border-rose-100 bg-rose-50 text-rose-700" : tone === "emerald" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-800"; return <div className={`rounded-2xl border p-4 ${style}`}><p className="text-xs font-bold opacity-70">{label}</p><p className="mt-2 text-base font-black sm:text-lg">{money(value, currency)}</p></div>; }
