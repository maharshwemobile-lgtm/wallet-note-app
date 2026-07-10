"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CircleCheck, Trash2 } from "lucide-react";

type Row = Record<string, string>;
type Data = {
  storage: { provider: string; connected: boolean; spreadsheetTitle: string };
  lotteries: Row[];
  lotterySummary: {
    total: { MMK: number; THB: number };
    pending: { MMK: number; THB: number };
    settled: { MMK: number; THB: number };
  };
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string | number, currency: string) => `${Number(value || 0).toLocaleString()} ${currency}`;

export default function LotteryAgentClient() {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
      await load();
      setMessage(`${json.sheet || "LotteryEntries"} Google Sheet ထဲသို့ သိမ်းဆည်းပြီးပါပြီ။`);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "မအောင်မြင်ပါ");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
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
        betAmount: Number(form.get("betAmount")),
        note: form.get("note"),
      },
    });
    if (ok) formElement.reset();
  }

  const rows = useMemo(
    () => (data?.lotteries ?? []).filter((row) => filter === "all" || row.status === filter),
    [data, filter],
  );

  if (!data) return <div className="card">ချဲစာရင်း ဖွင့်နေပါသည်...</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      <div className="flex items-center gap-2"><CircleCheck size={18}/><span>Google Sheet ချိတ်ဆက်ထားသည် — {data.storage.spreadsheetTitle}</span></div>
      <span className="text-xs font-bold">{data.storage.provider}</span>
    </div>

    {message && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
      <Summary label="ယနေ့/စုစုပေါင်း MMK" value={data.lotterySummary.total.MMK} currency="MMK" />
      <Summary label="ယနေ့/စုစုပေါင်း THB" value={data.lotterySummary.total.THB} currency="THB" />
      <Summary label="ဒိုင်ရှင်းရန် MMK" value={data.lotterySummary.pending.MMK} currency="MMK" tone="rose" />
      <Summary label="ဒိုင်ရှင်းရန် THB" value={data.lotterySummary.pending.THB} currency="THB" tone="rose" />
      <Summary label="ရှင်းပြီး MMK" value={data.lotterySummary.settled.MMK} currency="MMK" tone="emerald" />
      <Summary label="ရှင်းပြီး THB" value={data.lotterySummary.settled.THB} currency="THB" tone="emerald" />
    </section>

    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={submit} className="card grid h-fit gap-4 xl:sticky xl:top-8">
        <div><h2 className="text-lg font-bold">ချဲမှတ်တမ်းအသစ်</h2><p className="text-xs text-slate-500">Agent အနေဖြင့် ထိုးထားသည့်ပမာဏကိုသာ မှတ်ရန်</p></div>
        <label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option>2D</option><option>3D</option><option>Other</option></select></label>
        <label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label>
        <label className="form-label">ထိုးဂဏန်း<input name="number" inputMode="numeric" className="field mt-1 text-lg font-black tracking-widest" placeholder="ဥပမာ - 12" required /></label>
        <label className="form-label">ထိုးငွေပမာဏ<input name="betAmount" type="number" min="1" step="any" className="field mt-1" placeholder="0" required /></label>
        <label className="form-label">နေ့စွဲ<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label>
        <label className="form-label">မှတ်ချက်<textarea name="note" className="field mt-1 min-h-20" placeholder="ဖောက်သည်/အုပ်စု/မှတ်ချက်" /></label>
        <button disabled={busy} className="btn-primary py-3">Google Sheet ထဲ သိမ်းမည်</button>
      </form>

      <section className="card min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div><h2 className="font-bold">ချဲမှတ်တမ်း</h2><p className="text-xs text-slate-500">နောက်ရက် ဒိုင်ရှင်းရန် ပမာဏစစ်ဆေးနိုင်သည်</p></div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="field max-w-44"><option value="all">အားလုံး</option><option value="pending">မရှင်းရသေး</option><option value="settled">ရှင်းပြီး</option></select>
        </div>

        <div className="space-y-3 md:hidden">
          {rows.map((row) => <article key={row.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-2xl font-black tracking-widest">{row.number}</p><p className="text-xs text-slate-400">{row.type} · {row.date}</p></div><button onClick={() => request("DELETE", { entity: "lottery", id: row.id })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button></div>
            <div className="mt-4 flex items-center justify-between"><span className="text-sm text-slate-500">ထိုးငွေ</span><span className="font-black">{money(row.betAmount, row.currency)}</span></div>
            {row.note && <p className="mt-2 text-xs text-slate-500">{row.note}</p>}
            <button onClick={() => request("PATCH", { entity: "lottery", id: row.id, status: row.status === "settled" ? "pending" : "settled" })} className={`mt-4 w-full rounded-xl px-3 py-2 text-sm font-bold ${row.status === "settled" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.status === "settled" ? "ရှင်းပြီး — ပြန်ဖွင့်ရန်" : "ဒိုင်ရှင်းပြီးအဖြစ် မှတ်မည်"}</button>
          </article>)}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-3">နေ့စွဲ</th><th>အမျိုးအစား</th><th>ဂဏန်း</th><th>ငွေပမာဏ</th><th>မှတ်ချက်</th><th>ဒိုင်ရှင်းမှု</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="p-3">{row.date}</td><td>{row.type}</td><td className="font-mono text-lg font-black">{row.number}</td><td className="font-bold">{money(row.betAmount, row.currency)}</td><td className="max-w-52 truncate text-slate-500">{row.note || "-"}</td><td><button onClick={() => request("PATCH", { entity: "lottery", id: row.id, status: row.status === "settled" ? "pending" : "settled" })} className={`rounded-full px-3 py-1 text-xs font-bold ${row.status === "settled" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.status === "settled" ? "ရှင်းပြီး" : "မရှင်းရသေး"}</button></td><td><button onClick={() => request("DELETE", { entity: "lottery", id: row.id })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button></td></tr>)}</tbody></table>
        </div>

        {rows.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-400">ချဲမှတ်တမ်း မရှိသေးပါ။</div>}
      </section>
    </div>
  </div>;
}

function Summary({ label, value, currency, tone = "slate" }: { label: string; value: number; currency: string; tone?: "slate" | "rose" | "emerald" }) {
  const style = tone === "rose" ? "border-rose-100 bg-rose-50 text-rose-700" : tone === "emerald" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-800";
  return <div className={`rounded-2xl border p-4 ${style}`}><p className="text-[10px] font-bold opacity-70 sm:text-xs">{label}</p><p className="mt-2 text-base font-black sm:text-lg">{money(value, currency)}</p></div>;
}
