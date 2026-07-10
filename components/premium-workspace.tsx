"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CircleDollarSign, Dices, Plus, Printer, Trash2, WalletCards } from "lucide-react";

type Wallet = { id: string; name: string; currency: "MMK" | "THB"; initialBalance: number; balance: number };
type Remittance = Record<string, string>;
type Debt = Record<string, string>;
type Lottery = Record<string, string>;
type Workspace = {
  wallets: Wallet[];
  remittances: Remittance[];
  debts: Debt[];
  lotteries: Lottery[];
  debtSummary: { receivable: { MMK: number; THB: number }; payable: { MMK: number; THB: number } };
  lotterySummary: { bet: { MMK: number; THB: number }; win: { MMK: number; THB: number } };
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string | number, currency?: string) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

export default function PremiumWorkspace() {
  const [data, setData] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<"remit" | "debt" | "lottery">("remit");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"thb-mmk" | "mmk-thb">("thb-mmk");
  const [sourceAmount, setSourceAmount] = useState(0);
  const [rate, setRate] = useState(0);
  const [debtFilter, setDebtFilter] = useState("all");
  const [lotteryFilter, setLotteryFilter] = useState("all");

  async function load() {
    const res = await fetch("/api/premium", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "Unable to load workspace");
      return;
    }
    setData(json);
  }

  useEffect(() => { void load(); }, []);

  async function request(method: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/premium", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      await load();
      setMessage("သိမ်းဆည်းပြီးပါပြီ။");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const mmkWallets = data?.wallets.filter((wallet) => wallet.currency === "MMK") ?? [];
  const thbWallets = data?.wallets.filter((wallet) => wallet.currency === "THB") ?? [];
  const sourceWallets = mode === "thb-mmk" ? thbWallets : mmkWallets;
  const targetWallets = mode === "thb-mmk" ? mmkWallets : thbWallets;
  const converted = mode === "thb-mmk" ? sourceAmount * rate : rate > 0 ? sourceAmount / rate : 0;

  const debts = useMemo(() => (data?.debts ?? []).filter((debt) => {
    if (debtFilter === "all") return true;
    if (debtFilter === "receivable" || debtFilter === "payable") return debt.type === debtFilter;
    return debt.status === debtFilter;
  }), [data, debtFilter]);

  const lotteries = useMemo(() => (data?.lotteries ?? []).filter((lottery) => lotteryFilter === "all" || lottery.status === lotteryFilter), [data, lotteryFilter]);

  async function addWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("POST", { entity: "wallet", data: { name: form.get("name"), currency: form.get("currency"), initialBalance: Number(form.get("initialBalance")) } });
    event.currentTarget.reset();
  }

  async function addRemittance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("POST", { entity: "remittance", data: {
      date: form.get("date"), action: form.get("action"), mode,
      sourceWalletId: form.get("sourceWalletId"), targetWalletId: form.get("targetWalletId"),
      sourceAmount: Number(form.get("sourceAmount")), rate: Number(form.get("rate")),
      customerName: form.get("customerName"), note: form.get("note"),
    } });
    event.currentTarget.reset();
    setSourceAmount(0);
  }

  async function addDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("POST", { entity: "debt", data: {
      date: form.get("date"), type: form.get("type"), name: form.get("name"), currency: form.get("currency"),
      amount: Number(form.get("amount")), walletId: form.get("walletId"), note: form.get("note"),
    } });
    event.currentTarget.reset();
  }

  async function addLottery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("POST", { entity: "lottery", data: {
      date: form.get("date"), type: form.get("type"), currency: form.get("currency"), walletId: form.get("walletId"),
      number: form.get("number"), betAmount: Number(form.get("betAmount")), odds: Number(form.get("odds")),
    } });
    event.currentTarget.reset();
  }

  if (!data) return <div className="card">Loading premium workspace...</div>;

  return <div className="space-y-6">
    {message && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}

    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><WalletCards size={20}/> ငွေစာရင်းအကောင့်များ</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.wallets.map((wallet) => <div key={wallet.id} className="card relative">
          <button onClick={() => request("DELETE", { entity: "wallet", id: wallet.id })} className="absolute right-4 top-4 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
          <p className="text-xs font-bold text-slate-500">{wallet.currency}</p>
          <h3 className="mt-1 font-semibold">{wallet.name}</h3>
          <p className={`mt-4 text-2xl font-bold ${wallet.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{money(wallet.balance, wallet.currency)}</p>
        </div>)}
        <form onSubmit={addWallet} className="card grid gap-3 border-dashed">
          <div className="flex items-center gap-2 font-semibold"><Plus size={18}/> Wallet အသစ်</div>
          <input name="name" className="field" placeholder="KBZ Pay, Cash..." required/>
          <select name="currency" className="field"><option>MMK</option><option>THB</option></select>
          <input name="initialBalance" type="number" min="0" step="any" className="field" placeholder="Initial balance" required/>
          <button disabled={busy} className="btn-primary">Wallet ဖန်တီးမည်</button>
        </form>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary label="ရရန်ရှိ MMK" value={data.debtSummary.receivable.MMK}/>
      <Summary label="ရရန်ရှိ THB" value={data.debtSummary.receivable.THB}/>
      <Summary label="ပေးရန်ရှိ MMK" value={data.debtSummary.payable.MMK}/>
      <Summary label="ပေးရန်ရှိ THB" value={data.debtSummary.payable.THB}/>
    </section>

    <div className="flex overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
      <Tab active={tab === "remit"} onClick={() => setTab("remit")} icon={<ArrowLeftRight size={17}/>} label="ငွေလွှဲ/ငွေထုတ်"/>
      <Tab active={tab === "debt"} onClick={() => setTab("debt")} icon={<CircleDollarSign size={17}/>} label="အကြွေးစာရင်း"/>
      <Tab active={tab === "lottery"} onClick={() => setTab("lottery")} icon={<Dices size={17}/>} label="2D/3D"/>
    </div>

    {tab === "remit" && <div className="grid gap-6 xl:grid-cols-3">
      <form onSubmit={addRemittance} className="card grid h-fit gap-4">
        <h3 className="font-bold">ငွေလွှဲ/ငွေထုတ် စာရင်းသစ်</h3>
        <div className="grid grid-cols-2 gap-2">
          <select name="action" className="field"><option value="in">ငွေအဝင်</option><option value="out">ငွေအထွက်</option></select>
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="field"><option value="thb-mmk">THB → MMK</option><option value="mmk-thb">MMK → THB</option></select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select name="sourceWalletId" className="field" required><option value="">Source wallet</option>{sourceWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select>
          <select name="targetWalletId" className="field" required><option value="">Target wallet</option>{targetWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select>
        </div>
        <input name="sourceAmount" type="number" min="0.01" step="any" className="field" placeholder="လွှဲငွေ" onChange={(e) => setSourceAmount(Number(e.target.value))} required/>
        <input name="rate" type="number" min="0.01" step="any" className="field" placeholder="1 THB exchange rate" onChange={(e) => setRate(Number(e.target.value))} required/>
        <div className="rounded-xl bg-slate-100 p-4"><p className="text-xs text-slate-500">တွက်ချက်ပြီးငွေ</p><p className="text-xl font-bold">{money(converted, mode === "thb-mmk" ? "MMK" : "THB")}</p></div>
        <input name="date" type="date" defaultValue={today()} className="field" required/>
        <input name="customerName" className="field" placeholder="ဖောက်သည်အမည်" required/>
        <textarea name="note" className="field" placeholder="မှတ်ချက်"/>
        <button disabled={busy} className="btn-primary">စာရင်းသိမ်းမည်</button>
      </form>
      <div className="card overflow-auto xl:col-span-2">
        <div className="mb-4 flex items-center justify-between"><h3 className="font-bold">ငွေလွှဲမှတ်တမ်း</h3><button onClick={() => window.print()} className="btn-secondary flex items-center gap-2"><Printer size={16}/> Print / PDF</button></div>
        <table className="min-w-[850px] w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Date</th><th>Customer</th><th>Wallets</th><th>Source</th><th>Rate</th><th>Target</th><th/></tr></thead><tbody>{data.remittances.map((row) => <tr key={row.id} className="border-b"><td className="p-2">{row.date}</td><td>{row.customerName}</td><td>{row.sourceWalletId.slice(0, 6)} → {row.targetWalletId.slice(0, 6)}</td><td>{money(row.sourceAmount)}</td><td>{money(row.rate)}</td><td className="font-semibold text-emerald-600">{money(row.targetAmount)}</td><td><button onClick={() => request("DELETE", { entity: "remittance", id: row.id })}><Trash2 size={15}/></button></td></tr>)}</tbody></table>
      </div>
    </div>}

    {tab === "debt" && <div className="grid gap-6 xl:grid-cols-3">
      <form onSubmit={addDebt} className="card grid h-fit gap-3">
        <h3 className="font-bold">အကြွေးစာရင်းအသစ်</h3>
        <select name="type" className="field"><option value="receivable">ရရန်ရှိ</option><option value="payable">ပေးရန်ရှိ</option></select>
        <input name="name" className="field" placeholder="လူ/ဖောက်သည်အမည်" required/>
        <select name="currency" className="field"><option>MMK</option><option>THB</option></select>
        <input name="amount" type="number" min="1" step="any" className="field" placeholder="Amount" required/>
        <select name="walletId" className="field"><option value="">Wallet မချိတ်ပါ</option>{data.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} ({wallet.currency})</option>)}</select>
        <input name="date" type="date" defaultValue={today()} className="field" required/>
        <textarea name="note" className="field" placeholder="မှတ်ချက်"/>
        <button disabled={busy} className="btn-primary">စာရင်းသွင်းမည်</button>
      </form>
      <div className="card overflow-auto xl:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-bold">အကြွေးမှတ်တမ်း</h3><select value={debtFilter} onChange={(e) => setDebtFilter(e.target.value)} className="field max-w-48"><option value="all">အားလုံး</option><option value="receivable">ရရန်ရှိ</option><option value="payable">ပေးရန်ရှိ</option><option value="unpaid">မဆပ်ရသေး</option><option value="paid">ဆပ်ပြီး</option></select></div>
        <table className="min-w-[750px] w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Date</th><th>Name</th><th>Type</th><th>Amount</th><th>Status</th><th/></tr></thead><tbody>{debts.map((row) => <tr key={row.id} className="border-b"><td className="p-2">{row.date}</td><td>{row.name}<div className="text-xs text-slate-400">{row.note}</div></td><td>{row.type}</td><td className="font-semibold">{money(row.amount, row.currency)}</td><td><button onClick={() => request("PATCH", { entity: "debt", id: row.id, status: row.status === "paid" ? "unpaid" : "paid" })} className={`rounded-full px-3 py-1 text-xs font-bold ${row.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.status}</button></td><td><button onClick={() => request("DELETE", { entity: "debt", id: row.id })}><Trash2 size={15}/></button></td></tr>)}</tbody></table>
      </div>
    </div>}

    {tab === "lottery" && <div className="grid gap-6 xl:grid-cols-3">
      <form onSubmit={addLottery} className="card grid h-fit gap-3">
        <h3 className="font-bold">2D/3D စာရင်းသစ်</h3>
        <select name="type" className="field"><option>2D</option><option>3D</option><option>Other</option></select>
        <select name="currency" className="field"><option>MMK</option><option>THB</option></select>
        <select name="walletId" className="field" required><option value="">Wallet ရွေးပါ</option>{data.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} ({wallet.currency})</option>)}</select>
        <input name="number" className="field" placeholder="ဂဏန်း" required/>
        <input name="betAmount" type="number" min="1" step="any" className="field" placeholder="ထိုးကြေး" required/>
        <input name="odds" type="number" min="1" step="any" defaultValue="80" className="field" placeholder="ပေါက်ကြေး" required/>
        <input name="date" type="date" defaultValue={today()} className="field" required/>
        <button disabled={busy} className="btn-primary">စာရင်းသွင်းမည်</button>
      </form>
      <div className="space-y-4 xl:col-span-2">
        <div className="grid gap-3 sm:grid-cols-2"><Summary label="MMK ထိုးဖိုး / ပေါက်ငွေ" value={`${money(data.lotterySummary.bet.MMK)} / ${money(data.lotterySummary.win.MMK)}`}/><Summary label="THB ထိုးဖိုး / ပေါက်ငွေ" value={`${money(data.lotterySummary.bet.THB)} / ${money(data.lotterySummary.win.THB)}`}/></div>
        <div className="card overflow-auto"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-bold">ချဲစာရင်း</h3><select value={lotteryFilter} onChange={(e) => setLotteryFilter(e.target.value)} className="field max-w-44"><option value="all">အားလုံး</option><option value="pending">Pending</option><option value="won">Won</option><option value="lost">Lost</option></select></div>
        <table className="min-w-[760px] w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Date</th><th>Type</th><th>Number</th><th>Bet</th><th>Possible win</th><th>Status</th><th/></tr></thead><tbody>{lotteries.map((row) => <tr key={row.id} className="border-b"><td className="p-2">{row.date}</td><td>{row.type}</td><td className="font-mono text-lg font-bold">{row.number}</td><td>{money(row.betAmount, row.currency)}</td><td>{money(Number(row.betAmount) * Number(row.odds), row.currency)}</td><td><div className="flex gap-1"><button onClick={() => request("PATCH", { entity: "lottery", id: row.id, status: "won" })} className="rounded bg-emerald-100 px-2 py-1 text-xs">Won</button><button onClick={() => request("PATCH", { entity: "lottery", id: row.id, status: "lost" })} className="rounded bg-red-100 px-2 py-1 text-xs">Lost</button><button onClick={() => request("PATCH", { entity: "lottery", id: row.id, status: "pending" })} className="rounded bg-slate-100 px-2 py-1 text-xs">Reset</button></div></td><td><button onClick={() => request("DELETE", { entity: "lottery", id: row.id })}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>
      </div>
    </div>}
  </div>;
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{typeof value === "number" ? money(value) : value}</p></div>;
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className={`flex min-w-44 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{icon}{label}</button>;
}
