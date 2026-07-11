"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CircleCheck, Trophy, Trash2, WalletCards } from "lucide-react";

type Row = Record<string, string | number>;
type Wallet = { id: string; name: string; currency: "MMK" | "THB"; balance: number };
type Data = {
  storage: { provider: string; connected: boolean; spreadsheetTitle: string };
  wallets: Wallet[];
  lotteries: Row[];
  winners: Row[];
  results: Row[];
  lotterySummary: {
    total: { MMK: number; THB: number };
    pending: { MMK: number; THB: number };
    settled: { MMK: number; THB: number };
    winning: { MMK: number; THB: number };
  };
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string | number, currency: string) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

export default function LotteryAgentClient() {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [latestWinners, setLatestWinners] = useState<Row[]>([]);

  async function load() {
    const response = await fetch("/api/premium", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "စာရင်းဖွင့်မရပါ");
    setData(json);
  }

  useEffect(() => {
    load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "စာရင်းဖွင့်မရပါ"));
  }, []);

  async function request(method: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/premium", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "မအောင်မြင်ပါ");
      if (Array.isArray(json.winners)) setLatestWinners(json.winners);
      await load();
      setMessage(`${json.sheet || "Lottery"} ကို PostgreSQL ထဲတွင် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "မအောင်မြင်ပါ");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await request("POST", {
      entity: "lottery",
      data: {
        date: form.get("date"),
        type: form.get("type"),
        currency: form.get("currency"),
        number: form.get("number"),
        customerName: form.get("customerName"),
        betAmount: Number(form.get("betAmount")),
        payoutMultiplier: Number(form.get("payoutMultiplier")),
        note: form.get("note"),
      },
    });
    if (ok) formElement.reset();
  }

  async function submitSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("PATCH", {
      action: "settleLotteryDealer",
      date: form.get("date"),
      type: form.get("type"),
      currency: form.get("currency"),
      walletId: form.get("walletId"),
    });
  }

  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("POST", {
      entity: "lotteryResult",
      data: {
        date: form.get("date"),
        type: form.get("type"),
        currency: form.get("currency"),
        winningNumber: form.get("winningNumber"),
      },
    });
  }

  const rows = useMemo(
    () => (data?.lotteries ?? []).filter((row) => filter === "all" || row.status === filter),
    [data, filter],
  );
  const winners = latestWinners.length > 0 ? latestWinners : (data?.winners ?? []);

  if (!data) return <div className="card">ချဲစာရင်း ဖွင့်နေပါသည်...</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      <div className="flex items-center gap-2"><CircleCheck size={18}/><span>PostgreSQL Main Database ချိတ်ဆက်ထားသည်</span></div>
      <span className="text-xs font-bold">{data.storage.provider}</span>
    </div>

    {message && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
      <Summary label="စုစုပေါင်း MMK" value={data.lotterySummary.total.MMK} currency="MMK" />
      <Summary label="စုစုပေါင်း THB" value={data.lotterySummary.total.THB} currency="THB" />
      <Summary label="ဒိုင်ရှင်းရန် MMK" value={data.lotterySummary.pending.MMK} currency="MMK" tone="rose" />
      <Summary label="ဒိုင်ရှင်းရန် THB" value={data.lotterySummary.pending.THB} currency="THB" tone="rose" />
      <Summary label="ပေါက်ငွေ MMK" value={data.lotterySummary.winning.MMK} currency="MMK" tone="emerald" />
      <Summary label="ပေါက်ငွေ THB" value={data.lotterySummary.winning.THB} currency="THB" tone="emerald" />
    </section>

    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-5">
        <form onSubmit={submitEntry} className="card grid gap-4">
          <div><h2 className="text-lg font-bold">ချဲမှတ်တမ်းအသစ်</h2><p className="text-xs text-slate-500">မှတ်တမ်းတင်ချိန် wallet လက်ကျန် မနုတ်ပါ</p></div>
          <label className="form-label">ဖောက်သည်အမည်<input name="customerName" className="field mt-1" placeholder="အမည်" required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option>2D</option><option>3D</option><option>Other</option></select></label>
            <label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label>
          </div>
          <label className="form-label">ထိုးဂဏန်း<input name="number" inputMode="numeric" className="field mt-1 text-lg font-black tracking-widest" placeholder="ဥပမာ - 12" required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">ထိုးငွေ<input name="betAmount" type="number" min="1" step="any" className="field mt-1" required /></label>
            <label className="form-label">ပေါက်ဆ<input name="payoutMultiplier" type="number" min="1" step="any" defaultValue="80" className="field mt-1" required /></label>
          </div>
          <label className="form-label">နေ့စွဲ<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label>
          <label className="form-label">မှတ်ချက်<textarea name="note" className="field mt-1 min-h-20" /></label>
          <button disabled={busy} className="btn-primary py-3">ချဲစာရင်း သိမ်းမည်</button>
        </form>

        <form onSubmit={submitSettlement} className="card grid gap-4 border-amber-200 bg-amber-50/40">
          <div className="flex gap-3"><WalletCards className="text-amber-600"/><div><h2 className="font-bold">ချဲဒိုင်ကြီးကို ရှင်းမည်</h2><p className="text-xs text-slate-500">ဒီအချိန်မှသာ ရွေးထားသော wallet ကို စုစုပေါင်းထိုးငွေ နုတ်ပါမည်</p></div></div>
          <label className="form-label">နေ့စွဲ<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option>2D</option><option>3D</option><option>Other</option></select></label>
            <label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label>
          </div>
          <label className="form-label">နုတ်ယူမည့် Wallet<select name="walletId" className="field mt-1" required><option value="">Wallet ရွေးပါ</option>{data.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {money(wallet.balance, wallet.currency)}</option>)}</select></label>
          <button disabled={busy} className="rounded-xl bg-amber-500 px-4 py-3 font-bold text-slate-950">ဒိုင်ရှင်းပြီး Wallet နုတ်မည်</button>
        </form>

        <form onSubmit={submitResult} className="card grid gap-4 border-emerald-200 bg-emerald-50/40">
          <div className="flex gap-3"><Trophy className="text-emerald-600"/><div><h2 className="font-bold">ပေါက်ဂဏန်း ထည့်မည်</h2><p className="text-xs text-slate-500">ထည့်ပြီးတာနဲ့ ပေါက်သူအရေအတွက်နဲ့ လူစာရင်းပြမည်</p></div></div>
          <label className="form-label">နေ့စွဲ<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option>2D</option><option>3D</option><option>Other</option></select></label>
            <label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label>
          </div>
          <label className="form-label">ပေါက်ဂဏန်း<input name="winningNumber" inputMode="numeric" className="field mt-1 text-xl font-black tracking-widest" required /></label>
          <button disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">ပေါက်သူများ စစ်မည်</button>
        </form>
      </div>

      <div className="space-y-5">
        <section className="card">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">ပေါက်သူများ</h2><p className="text-xs text-slate-500">စုစုပေါင်း {winners.length} ယောက်</p></div><Trophy className="text-amber-500" /></div>
          {winners.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-400">ပေါက်သူ မရှိသေးပါ</div> : <div className="space-y-3">{winners.map((row) => <div key={String(row.id)} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4"><div><p className="font-bold">{String(row.customerName || "အမည်မရှိ")}</p><p className="text-xs text-slate-500">ဂဏန်း {String(row.number)} · ထိုးငွေ {money(row.betAmount, String(row.currency))}</p></div><div className="text-right"><p className="text-xs text-slate-500">ပေါက်ငွေ</p><p className="font-black text-emerald-700">{money(row.payoutAmount, String(row.currency))}</p></div></div>)}</div>}
        </section>

        <section className="card min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4"><div><h2 className="font-bold">ချဲမှတ်တမ်း</h2><p className="text-xs text-slate-500">PostgreSQL မှတ်တမ်း</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="field max-w-44"><option value="all">အားလုံး</option><option value="pending">မရှင်းရသေး</option><option value="settled">ရှင်းပြီး</option></select></div>
          <div className="space-y-3">{rows.map((row) => <article key={String(row.id)} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{String(row.customerName)}</p><p className="font-mono text-2xl font-black tracking-widest">{String(row.number)}</p><p className="text-xs text-slate-400">{String(row.type)} · {String(row.date)}</p></div>{row.status === "pending" && <button onClick={() => request("DELETE", { entity: "lottery", id: row.id })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button>}</div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-slate-500">ထိုးငွေ</span><p className="font-black">{money(row.betAmount, String(row.currency))}</p></div><div><span className="text-slate-500">အခြေအနေ</span><p className={`font-bold ${row.status === "settled" ? "text-emerald-600" : "text-amber-600"}`}>{row.status === "settled" ? "ဒိုင်ရှင်းပြီး" : "ဒိုင်ရှင်းရန်"}</p></div></div>{row.resultStatus === "won" && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">ပေါက်သည် — {money(row.payoutAmount, String(row.currency))}</div>}{row.resultStatus === "lost" && <div className="mt-3 text-xs font-bold text-slate-400">မပေါက်ပါ</div>}</article>)}</div>
          {rows.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-400">ချဲမှတ်တမ်း မရှိသေးပါ။</div>}
        </section>
      </div>
    </div>
  </div>;
}

function Summary({ label, value, currency, tone = "slate" }: { label: string; value: number; currency: string; tone?: "slate" | "rose" | "emerald" }) {
  const style = tone === "rose" ? "border-rose-100 bg-rose-50 text-rose-700" : tone === "emerald" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-800";
  return <div className={`rounded-2xl border p-4 ${style}`}><p className="text-[10px] font-bold opacity-70 sm:text-xs">{label}</p><p className="mt-2 text-base font-black sm:text-lg">{money(value, currency)}</p></div>;
}
