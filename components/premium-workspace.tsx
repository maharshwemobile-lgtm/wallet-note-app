"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CircleCheck, Plus, Trash2, WalletCards } from "lucide-react";

export type WorkspaceView = "wallets" | "remittance" | "debts" | "lottery";
type Wallet = { id: string; name: string; currency: "MMK" | "THB"; initialBalance: number; balance: number };
type Row = Record<string, any>;
type Workspace = { wallets: Wallet[]; remittances: Row[]; debts: Row[]; lotteries: Row[]; debtSummary: any; lotterySummary: any };

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string | number, currency?: string) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

export default function PremiumWorkspace({ view }: { view: WorkspaceView }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<"mmk-thb" | "thb-mmk">("mmk-thb");
  const [sourceAmount, setSourceAmount] = useState(0);
  const [rate, setRate] = useState(0);
  const [targetAmount, setTargetAmount] = useState(0);
  const [feeAmount, setFeeAmount] = useState(0);
  const [debtFilter, setDebtFilter] = useState("all");

  async function load() {
    const res = await fetch("/api/premium", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Workspace ဖွင့်မရပါ");
    setData(json);
  }

  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : "Workspace ဖွင့်မရပါ")); }, []);

  async function request(method: string, body: unknown) {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/premium", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      await load();
      setMessage("အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
      return false;
    } finally { setBusy(false); }
  }

  const mmkWallets = data?.wallets.filter((wallet) => wallet.currency === "MMK") ?? [];
  const thbWallets = data?.wallets.filter((wallet) => wallet.currency === "THB") ?? [];
  const sourceWallets = action === "mmk-thb" ? mmkWallets : thbWallets;
  const targetWallets = action === "mmk-thb" ? thbWallets : mmkWallets;
  const converted = targetAmount > 0 ? targetAmount : rate > 0 ? (action === "thb-mmk" ? sourceAmount * rate : sourceAmount / rate) : 0;
  const totalWithFee = converted + feeAmount;
  const walletById = (id: string) => data?.wallets.find((wallet) => wallet.id === id);
  const walletName = (id: string) => walletById(id)?.name || "Wallet";
  const debts = useMemo(() => (data?.debts ?? []).filter((debt) => debtFilter === "all" || debt.type === debtFilter || debt.status === debtFilter), [data, debtFilter]);

  async function addWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await request("POST", { entity: "wallet", data: { name: form.get("name"), currency: form.get("currency"), initialBalance: Number(form.get("initialBalance")) } })) event.currentTarget.reset();
  }

  async function addRemittance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const ok = await request("POST", { entity: "remittance", data: {
      date: form.get("date"), action, sourceWalletId: form.get("sourceWalletId"), targetWalletId: form.get("targetWalletId"),
      sourceAmount: Number(form.get("sourceAmount")), rate: Number(form.get("rate") || 0), targetAmount: Number(form.get("targetAmount") || 0),
      feeAmount: Number(form.get("feeAmount") || 0), transferMethod: form.get("transferMethod"), statusDetail: form.get("statusDetail"), customerName: form.get("customerName"), note: form.get("note"),
    }});
    if (ok) { event.currentTarget.reset(); setSourceAmount(0); setRate(0); setTargetAmount(0); setFeeAmount(0); }
  }

  async function addDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await request("POST", { entity: "debt", data: {
      date: form.get("date"), type: form.get("type"), name: form.get("name"), currency: form.get("currency"), amount: Number(form.get("amount")),
      interestMode: form.get("interestMode"), interestValue: Number(form.get("interestValue") || 0), interestLabel: form.get("interestLabel"), repaymentPlan: form.get("repaymentPlan"),
      startDate: form.get("startDate"), dueDate: form.get("dueDate"), installmentAmount: Number(form.get("installmentAmount") || 0), walletId: form.get("walletId"), note: form.get("note"),
    }})) event.currentTarget.reset();
  }

  async function payDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await request("POST", { entity: "debtPayment", data: { debtId: form.get("debtId"), walletId: form.get("walletId"), amount: Number(form.get("amount")), note: form.get("note") } })) event.currentTarget.reset();
  }

  if (!data) return <div className="card">စာရင်းများ ဖွင့်နေပါသည်...</div>;

  return <div className="space-y-5">
    {message && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"><CircleCheck size={18} className="text-emerald-600" />{message}</div>}

    {view === "wallets" && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{data.wallets.map((wallet) => <article key={wallet.id} className="card relative overflow-hidden"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{wallet.currency}</span><h3 className="mt-3 font-bold">{wallet.name}</h3><p className="mt-5 text-xs text-slate-500">လက်ကျန်ငွေ</p><p className={`mt-1 text-2xl font-black ${wallet.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{money(wallet.balance, wallet.currency)}</p><button onClick={() => request("DELETE", { entity: "wallet", id: wallet.id })} className="absolute right-4 top-4 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button></article>)}</section>
      <form onSubmit={addWallet} className="card grid h-fit gap-4"><div className="flex items-center gap-2 text-lg font-bold"><Plus size={20}/>Wallet အသစ်</div><label className="form-label">Wallet အမည်<input name="name" className="field mt-1" required /></label><label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label><label className="form-label">အစပျိုးငွေ<input name="initialBalance" type="number" min="0" step="any" className="field mt-1" required /></label><button disabled={busy} className="btn-primary py-3">Wallet ဖန်တီးမည်</button></form>
    </div>}

    {view === "remittance" && <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <form onSubmit={addRemittance} className="card grid h-fit gap-4 xl:sticky xl:top-8"><div><h2 className="text-lg font-bold">ငွေလွှဲ/ငွေထုတ်</h2><p className="text-xs text-slate-500">လုပ်ဆောင်ချက်နှင့် Wallet ကို ကိုယ်တိုင်ရွေးပါ</p></div>
        <label className="form-label">လုပ်ဆောင်ချက်<select value={action} onChange={(event) => setAction(event.target.value as typeof action)} className="field mt-1"><option value="mmk-thb">ကျပ်ပေး ဘတ်ယူ</option><option value="thb-mmk">ဘတ်ပေး ကျပ်ယူ</option></select></label>
        <label className="form-label">ထွက်မည့် Wallet<select name="sourceWalletId" className="field mt-1" required><option value="">Wallet ရွေးပါ</option>{sourceWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {money(wallet.balance, wallet.currency)}</option>)}</select></label>
        <label className="form-label">ဝင်မည့် Wallet<select name="targetWalletId" className="field mt-1" required><option value="">Wallet ရွေးပါ</option>{targetWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {money(wallet.balance, wallet.currency)}</option>)}</select></label>
        <label className="form-label">ထွက်ငွေ<input name="sourceAmount" type="number" min="0.01" step="any" className="field mt-1" onChange={(e)=>setSourceAmount(Number(e.target.value))} required /></label>
        <div className="grid grid-cols-2 gap-3"><label className="form-label">Rate optional<input name="rate" type="number" min="0" step="any" className="field mt-1" onChange={(e)=>setRate(Number(e.target.value))} /></label><label className="form-label">ဝင်ငွေ Manual<input name="targetAmount" type="number" min="0" step="any" className="field mt-1" onChange={(e)=>setTargetAmount(Number(e.target.value))} /></label></div>
        <div className="grid grid-cols-2 gap-3"><label className="form-label">Fee optional<input name="feeAmount" type="number" min="0" step="any" className="field mt-1" onChange={(e)=>setFeeAmount(Number(e.target.value))} /></label><label className="form-label">နည်းလမ်း<select name="transferMethod" className="field mt-1"><option>Cash</option><option>Wallet</option></select></label></div>
        <label className="form-label">Status<select name="statusDetail" className="field mt-1"><option>ထုတ်ပေးရန်</option><option>ထုတ်ပေးပြီး</option><option>လွှဲရန်</option><option>လွှဲပြီး</option></select></label>
        <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">ဝင်ငွေ + Fee</p><p className="mt-1 text-2xl font-black text-emerald-700">{money(totalWithFee, action === "thb-mmk" ? "MMK" : "THB")}</p></div>
        <label className="form-label">နေ့စွဲ<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label><label className="form-label">ဖောက်သည်<input name="customerName" className="field mt-1" required /></label><label className="form-label">မှတ်ချက်<textarea name="note" className="field mt-1 min-h-20" /></label><button disabled={busy} className="btn-primary py-3">စာရင်းသိမ်းမည်</button>
      </form>
      <HistoryPanel title="ငွေလွှဲမှတ်တမ်း">{data.remittances.map((row) => <article key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{row.customerName}</p><p className="text-xs text-slate-400">{row.date} · {row.action === "mmk-thb" ? "ကျပ်ပေး ဘတ်ယူ" : "ဘတ်ပေး ကျပ်ယူ"}</p></div><Link className="text-sm font-bold text-blue-600" href={`/remittance/${row.id}`}>Detail / Print</Link></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><Line label="Wallet" value={`${walletName(row.sourceWalletId)} → ${walletName(row.targetWalletId)}`} /><Line label="ထွက်ငွေ" value={money(row.sourceAmount, walletById(row.sourceWalletId)?.currency)} /><Line label="ဝင်ငွေ" value={money(row.targetAmount, walletById(row.targetWalletId)?.currency)} /><Line label="Fee" value={money(row.feeAmount, walletById(row.targetWalletId)?.currency)} /><Line label="Status" value={row.statusDetail || "-"} /></div></article>)}</HistoryPanel>
    </div>}

    {view === "debts" && <><div className="grid gap-3 grid-cols-2 xl:grid-cols-4"><Summary label="ရရန်ရှိ MMK" value={data.debtSummary.receivable.MMK} currency="MMK" tone="emerald"/><Summary label="ရရန်ရှိ THB" value={data.debtSummary.receivable.THB} currency="THB" tone="emerald"/><Summary label="ပေးရန်ရှိ MMK" value={data.debtSummary.payable.MMK} currency="MMK" tone="rose"/><Summary label="ပေးရန်ရှိ THB" value={data.debtSummary.payable.THB} currency="THB" tone="rose"/></div><div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]"><div className="space-y-5"><form onSubmit={addDebt} className="card grid gap-4"><h2 className="text-lg font-bold">အကြွေးစာရင်း</h2><label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option value="receivable">ရရန်ရှိ</option><option value="payable">ပေးရန်ရှိ</option></select></label><label className="form-label">အမည်<input name="name" className="field mt-1" required /></label><div className="grid grid-cols-2 gap-3"><label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label><label className="form-label">မူရင်းငွေ<input name="amount" type="number" min="1" step="any" className="field mt-1" required /></label></div><div className="grid grid-cols-2 gap-3"><label className="form-label">အတိုး<select name="interestMode" className="field mt-1"><option value="none">မရှိ</option><option value="kyat-per-hundred">၃/၄ ကျပ်တိုး</option><option value="percent">Percent</option></select></label><label className="form-label">တန်ဖိုး<input name="interestValue" type="number" min="0" step="any" className="field mt-1" placeholder="3 or 4" /></label></div><label className="form-label">အတိုး Label<input name="interestLabel" className="field mt-1" placeholder="၃ ကျပ်တိုး" /></label><label className="form-label">ပြန်ဆပ်မည့် Plan<select name="repaymentPlan" className="field mt-1"><option value="one-time">တစ်ကြိမ်တည်း</option><option value="monthly">လစဉ်</option><option value="yearly">နှစ်စဉ်</option><option value="custom">Custom</option></select></label><div className="grid grid-cols-2 gap-3"><label className="form-label">စနေ့<input name="startDate" type="date" defaultValue={today()} className="field mt-1" /></label><label className="form-label">Due Date<input name="dueDate" type="date" className="field mt-1" /></label></div><label className="form-label">Installment optional<input name="installmentAmount" type="number" min="0" step="any" className="field mt-1" /></label><label className="form-label">Wallet<select name="walletId" className="field mt-1"><option value="">မချိတ်ပါ</option>{data.wallets.map((wallet)=><option key={wallet.id} value={wallet.id}>{wallet.name} ({wallet.currency})</option>)}</select></label><label className="form-label">မှတ်ချက်<textarea name="note" className="field mt-1 min-h-20" /></label><button disabled={busy} className="btn-primary py-3">အကြွေးသိမ်းမည်</button></form><form onSubmit={payDebt} className="card grid gap-4"><h2 className="font-bold">အကြွေးဆပ်ငွေ</h2><label className="form-label">အကြွေး<select name="debtId" className="field mt-1" required>{debts.map((debt)=><option key={debt.id} value={debt.id}>{debt.name} — ကျန် {money(debt.remainingAmount, debt.currency)}</option>)}</select></label><label className="form-label">Wallet<select name="walletId" className="field mt-1"><option value="">Wallet မထိပါ</option>{data.wallets.map((wallet)=><option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label><label className="form-label">ဆပ်ငွေ<input name="amount" type="number" min="1" step="any" className="field mt-1" required /></label><label className="form-label">မှတ်ချက်<input name="note" className="field mt-1" /></label><button className="btn-primary py-3">Payment မှတ်မည်</button></form></div><HistoryPanel title="အကြွေးမှတ်တမ်း" filter={<select value={debtFilter} onChange={(e)=>setDebtFilter(e.target.value)} className="field max-w-44"><option value="all">အားလုံး</option><option value="receivable">ရရန်ရှိ</option><option value="payable">ပေးရန်ရှိ</option><option value="unpaid">မဆပ်ရသေး</option><option value="partial">တချို့ဆပ်</option><option value="paid">ဆပ်ပြီး</option></select>}>{debts.map((row)=><article key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between"><div><p className="font-bold">{row.name}</p><p className="text-xs text-slate-400">{row.repaymentPlan} · {row.interestLabel || row.interestMode}</p></div><DeleteButton onClick={()=>request("DELETE",{entity:"debt",id:row.id})}/></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><Line label="မူရင်း" value={money(row.principalAmount,row.currency)} /><Line label="အတိုး" value={money(row.interestAmount,row.currency)} /><Line label="စုစုပေါင်း" value={money(row.totalAmount,row.currency)} /><Line label="ဆပ်ပြီး" value={money(row.paidAmount,row.currency)} /><Line label="ကျန်ငွေ" value={money(row.remainingAmount,row.currency)} /><Line label="Status" value={row.status} /></div></article>)}</HistoryPanel></div></>}

    {view === "lottery" && <div className="card"><p className="font-bold">ချဲစာရင်းကို Lottery menu မှ ဖွင့်ပါ။</p><Link className="mt-3 inline-block text-blue-600 underline" href="/lottery">Lottery Page သို့</Link></div>}
  </div>;
}

function HistoryPanel({ title, children, filter }: { title: string; children: React.ReactNode; filter?: React.ReactNode }) { return <section className="card min-w-0"><div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4"><h2 className="font-bold">{title}</h2>{filter}</div><div className="space-y-3">{children}</div></section>; }
function Line({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-800">{value}</span></div>; }
function Summary({ label, value, currency, tone }: { label: string; value: number; currency: string; tone: "emerald" | "rose" }) { return <div className={`rounded-2xl border p-4 ${tone === "emerald" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}><p className="text-xs font-bold opacity-70">{label}</p><p className="mt-2 text-lg font-black">{money(value, currency)}</p></div>; }
function DeleteButton({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button>; }
