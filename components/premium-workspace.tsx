"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CircleCheck, Plus, Printer, Trash2, WalletCards } from "lucide-react";

export type WorkspaceView = "wallets" | "remittance" | "debts" | "lottery";

type Wallet = {
  id: string;
  name: string;
  currency: "MMK" | "THB";
  initialBalance: number;
  balance: number;
};

type Row = Record<string, string>;
type Workspace = {
  wallets: Wallet[];
  remittances: Row[];
  debts: Row[];
  lotteries: Row[];
  debtSummary: {
    receivable: { MMK: number; THB: number };
    payable: { MMK: number; THB: number };
  };
  lotterySummary: {
    bet: { MMK: number; THB: number };
    win: { MMK: number; THB: number };
  };
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string | number, currency?: string) =>
  `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

export default function PremiumWorkspace({ view }: { view: WorkspaceView }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"thb-mmk" | "mmk-thb">("thb-mmk");
  const [sourceAmount, setSourceAmount] = useState(0);
  const [rate, setRate] = useState(0);
  const [debtFilter, setDebtFilter] = useState("all");
  const [lotteryFilter, setLotteryFilter] = useState("all");
  const [lotteryCurrency, setLotteryCurrency] = useState<"MMK" | "THB">("MMK");

  async function load() {
    const res = await fetch("/api/premium", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "Unable to load workspace");
      return;
    }
    setData(json);
  }

  useEffect(() => {
    void load();
  }, []);

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
      setMessage("အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const mmkWallets = data?.wallets.filter((wallet) => wallet.currency === "MMK") ?? [];
  const thbWallets = data?.wallets.filter((wallet) => wallet.currency === "THB") ?? [];
  const sourceWallets = mode === "thb-mmk" ? thbWallets : mmkWallets;
  const targetWallets = mode === "thb-mmk" ? mmkWallets : thbWallets;
  const converted = mode === "thb-mmk" ? sourceAmount * rate : rate > 0 ? sourceAmount / rate : 0;
  const lotteryWallets = data?.wallets.filter((wallet) => wallet.currency === lotteryCurrency) ?? [];

  const debts = useMemo(
    () =>
      (data?.debts ?? []).filter((debt) => {
        if (debtFilter === "all") return true;
        if (debtFilter === "receivable" || debtFilter === "payable") return debt.type === debtFilter;
        return debt.status === debtFilter;
      }),
    [data, debtFilter],
  );

  const lotteries = useMemo(
    () => (data?.lotteries ?? []).filter((lottery) => lotteryFilter === "all" || lottery.status === lotteryFilter),
    [data, lotteryFilter],
  );

  const walletById = (id: string) => data?.wallets.find((wallet) => wallet.id === id);
  const walletName = (id: string) => walletById(id)?.name || "ဖျက်ထားသော Wallet";

  async function addWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await request("POST", {
      entity: "wallet",
      data: {
        name: form.get("name"),
        currency: form.get("currency"),
        initialBalance: Number(form.get("initialBalance")),
      },
    });
    if (ok) formElement.reset();
  }

  async function addRemittance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await request("POST", {
      entity: "remittance",
      data: {
        date: form.get("date"),
        action: form.get("action"),
        mode,
        sourceWalletId: form.get("sourceWalletId"),
        targetWalletId: form.get("targetWalletId"),
        sourceAmount: Number(form.get("sourceAmount")),
        rate: Number(form.get("rate")),
        customerName: form.get("customerName"),
        note: form.get("note"),
      },
    });
    if (ok) {
      formElement.reset();
      setSourceAmount(0);
      setRate(0);
    }
  }

  async function addDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await request("POST", {
      entity: "debt",
      data: {
        date: form.get("date"),
        type: form.get("type"),
        name: form.get("name"),
        currency: form.get("currency"),
        amount: Number(form.get("amount")),
        walletId: form.get("walletId"),
        note: form.get("note"),
      },
    });
    if (ok) formElement.reset();
  }

  async function addLottery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await request("POST", {
      entity: "lottery",
      data: {
        date: form.get("date"),
        type: form.get("type"),
        currency: form.get("currency"),
        walletId: form.get("walletId"),
        number: form.get("number"),
        betAmount: Number(form.get("betAmount")),
        odds: Number(form.get("odds")),
      },
    });
    if (ok) formElement.reset();
  }

  if (!data) return <div className="card">စာရင်းများ ဖွင့်နေပါသည်...</div>;

  return (
    <div className="space-y-5">
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <CircleCheck size={18} className="text-emerald-600" />
          {message}
        </div>
      )}

      {view === "wallets" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="mb-4 flex items-center gap-2">
              <WalletCards size={21} className="text-emerald-600" />
              <div>
                <h2 className="font-bold">ငွေစာရင်းအကောင့်များ</h2>
                <p className="text-xs text-slate-500">Cash၊ Bank၊ Mobile Pay နှင့် အခြား Wallet များ</p>
              </div>
            </div>
            {data.wallets.length === 0 ? (
              <Empty text="Wallet မရှိသေးပါ။ Wallet အသစ်တစ်ခု ဖန်တီးပါ။" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {data.wallets.map((wallet) => (
                  <article key={wallet.id} className="card relative overflow-hidden">
                    <div className="absolute -bottom-5 -right-2 text-7xl font-black text-slate-100">
                      {wallet.currency === "MMK" ? "Ks" : "฿"}
                    </div>
                    <button
                      onClick={() => request("DELETE", { entity: "wallet", id: wallet.id })}
                      className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete wallet"
                    >
                      <Trash2 size={16} />
                    </button>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                      {wallet.currency}
                    </span>
                    <h3 className="mt-3 font-bold text-slate-800">{wallet.name}</h3>
                    <p className="mt-5 text-xs text-slate-500">လက်ကျန်ငွေ</p>
                    <p className={`relative mt-1 text-2xl font-black ${wallet.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {money(wallet.balance, wallet.currency)}
                    </p>
                    <p className="relative mt-2 text-[11px] text-slate-400">
                      အစပျိုးငွေ {money(wallet.initialBalance, wallet.currency)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={addWallet} className="card grid h-fit gap-4 xl:sticky xl:top-8">
            <div className="flex items-center gap-2 text-lg font-bold">
              <Plus size={20} className="text-emerald-600" /> Wallet အသစ်
            </div>
            <label className="form-label">Wallet အမည်<input name="name" className="field mt-1" placeholder="ဥပမာ - KBZ Pay, Cash" required /></label>
            <label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label>
            <label className="form-label">အစပျိုးငွေ<input name="initialBalance" type="number" min="0" step="any" className="field mt-1" placeholder="0" required /></label>
            <button disabled={busy} className="btn-primary py-3">Wallet ဖန်တီးမည်</button>
          </form>
        </div>
      )}

      {view === "remittance" && (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <form onSubmit={addRemittance} className="card grid h-fit gap-4 xl:sticky xl:top-8">
            <div>
              <h2 className="text-lg font-bold">ငွေလွှဲ/ငွေထုတ်</h2>
              <p className="text-xs text-slate-500">THB နှင့် MMK ကြား စာရင်းသွင်းရန်</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="form-label">လုပ်ဆောင်ချက်<select name="action" className="field mt-1"><option value="in">ငွေအဝင်</option><option value="out">ငွေအထွက်</option></select></label>
              <label className="form-label">ငွေလဲပုံ<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="field mt-1"><option value="thb-mmk">THB → MMK</option><option value="mmk-thb">MMK → THB</option></select></label>
            </div>
            <label className="form-label">ပေးသည့် Wallet<select name="sourceWalletId" className="field mt-1" required><option value="">Wallet ရွေးပါ</option>{sourceWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {money(wallet.balance, wallet.currency)}</option>)}</select></label>
            <label className="form-label">လက်ခံသည့် Wallet<select name="targetWalletId" className="field mt-1" required><option value="">Wallet ရွေးပါ</option>{targetWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {money(wallet.balance, wallet.currency)}</option>)}</select></label>
            <label className="form-label">မူရင်းငွေပမာဏ<input name="sourceAmount" type="number" min="0.01" step="any" className="field mt-1" placeholder="0" onChange={(event) => setSourceAmount(Number(event.target.value))} required /></label>
            <label className="form-label">1 THB လဲလှယ်နှုန်း<input name="rate" type="number" min="0.01" step="any" className="field mt-1" placeholder="0" onChange={(event) => setRate(Number(event.target.value))} required /></label>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-700">တွက်ချက်ပြီးရရှိမည့်ငွေ</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">{money(converted, mode === "thb-mmk" ? "MMK" : "THB")}</p>
            </div>
            <label className="form-label">နေ့စွဲ<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label>
            <label className="form-label">ဖောက်သည်အမည်<input name="customerName" className="field mt-1" placeholder="အမည်" required /></label>
            <label className="form-label">မှတ်ချက်<textarea name="note" className="field mt-1 min-h-20" placeholder="အသေးစိတ်မှတ်စု" /></label>
            <button disabled={busy} className="btn-primary py-3">စာရင်းသိမ်းမည်</button>
          </form>

          <HistoryPanel title="ငွေလွှဲမှတ်တမ်း" onPrint={() => window.print()}>
            <div className="space-y-3 md:hidden">
              {data.remittances.map((row) => {
                const source = walletById(row.sourceWalletId);
                const target = walletById(row.targetWalletId);
                return <MobileRecord key={row.id} title={row.customerName} subtitle={row.date} onDelete={() => request("DELETE", { entity: "remittance", id: row.id })}>
                  <Line label="Wallet" value={`${walletName(row.sourceWalletId)} → ${walletName(row.targetWalletId)}`} />
                  <Line label="မူရင်းငွေ" value={money(row.sourceAmount, source?.currency)} />
                  <Line label="လဲနှုန်း" value={money(row.rate, "MMK")} />
                  <Line label="ရရှိငွေ" value={money(row.targetAmount, target?.currency)} strong />
                </MobileRecord>;
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="border-b text-xs text-slate-500"><th className="p-3">နေ့စွဲ</th><th>ဖောက်သည်</th><th>Wallet</th><th>မူရင်းငွေ</th><th>လဲနှုန်း</th><th>ရရှိငွေ</th><th /></tr></thead>
                <tbody>{data.remittances.map((row) => {
                  const source = walletById(row.sourceWalletId);
                  const target = walletById(row.targetWalletId);
                  return <tr key={row.id} className="border-b last:border-0"><td className="p-3">{row.date}</td><td className="font-semibold">{row.customerName}</td><td>{walletName(row.sourceWalletId)} → {walletName(row.targetWalletId)}</td><td>{money(row.sourceAmount, source?.currency)}</td><td>{money(row.rate)}</td><td className="font-bold text-emerald-600">{money(row.targetAmount, target?.currency)}</td><td><DeleteButton onClick={() => request("DELETE", { entity: "remittance", id: row.id })} /></td></tr>;
                })}</tbody>
              </table>
            </div>
            {data.remittances.length === 0 && <Empty text="ငွေလွှဲမှတ်တမ်း မရှိသေးပါ။" />}
          </HistoryPanel>
        </div>
      )}

      {view === "debts" && (
        <>
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            <Summary label="ရရန်ရှိ MMK" value={data.debtSummary.receivable.MMK} currency="MMK" tone="emerald" />
            <Summary label="ရရန်ရှိ THB" value={data.debtSummary.receivable.THB} currency="THB" tone="emerald" />
            <Summary label="ပေးရန်ရှိ MMK" value={data.debtSummary.payable.MMK} currency="MMK" tone="rose" />
            <Summary label="ပေးရန်ရှိ THB" value={data.debtSummary.payable.THB} currency="THB" tone="rose" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <form onSubmit={addDebt} className="card grid h-fit gap-4 xl:sticky xl:top-8">
              <div><h2 className="text-lg font-bold">အကြွေးစာရင်း</h2><p className="text-xs text-slate-500">ရရန်ရှိနှင့် ပေးရန်ရှိ စာရင်းများ</p></div>
              <label className="form-label">အကြွေးအမျိုးအစား<select name="type" className="field mt-1"><option value="receivable">ရရန်ရှိ</option><option value="payable">ပေးရန်ရှိ</option></select></label>
              <label className="form-label">လူ/ဖောက်သည်အမည်<input name="name" className="field mt-1" placeholder="အမည်" required /></label>
              <label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label>
              <label className="form-label">အကြွေးပမာဏ<input name="amount" type="number" min="1" step="any" className="field mt-1" placeholder="0" required /></label>
              <label className="form-label">ဆပ်ချိန် ချိတ်မည့် Wallet<select name="walletId" className="field mt-1"><option value="">Wallet မချိတ်ပါ</option>{data.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} ({wallet.currency})</option>)}</select></label>
              <label className="form-label">နေ့စွဲ<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label>
              <label className="form-label">မှတ်ချက်<textarea name="note" className="field mt-1 min-h-20" /></label>
              <button disabled={busy} className="btn-primary py-3">စာရင်းသွင်းမည်</button>
            </form>

            <HistoryPanel title="အကြွေးမှတ်တမ်း" filter={<select value={debtFilter} onChange={(event) => setDebtFilter(event.target.value)} className="field max-w-44"><option value="all">အားလုံး</option><option value="receivable">ရရန်ရှိ</option><option value="payable">ပေးရန်ရှိ</option><option value="unpaid">မဆပ်ရသေး</option><option value="paid">ဆပ်ပြီး</option></select>}>
              <div className="space-y-3 md:hidden">
                {debts.map((row) => <MobileRecord key={row.id} title={row.name} subtitle={row.date} onDelete={() => request("DELETE", { entity: "debt", id: row.id })}>
                  <Line label="အမျိုးအစား" value={row.type === "receivable" ? "ရရန်ရှိ" : "ပေးရန်ရှိ"} />
                  <Line label="ငွေပမာဏ" value={money(row.amount, row.currency)} strong />
                  <Line label="မှတ်ချက်" value={row.note || "-"} />
                  <StatusButton label={row.status === "paid" ? "ဆပ်ပြီး" : "မဆပ်ရသေး"} active={row.status === "paid"} onClick={() => request("PATCH", { entity: "debt", id: row.id, status: row.status === "paid" ? "unpaid" : "paid" })} />
                </MobileRecord>)}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-3">နေ့စွဲ</th><th>အမည်</th><th>အမျိုးအစား</th><th>ငွေပမာဏ</th><th>အခြေအနေ</th><th /></tr></thead><tbody>{debts.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="p-3">{row.date}</td><td><span className="font-semibold">{row.name}</span><div className="text-xs text-slate-400">{row.note}</div></td><td>{row.type === "receivable" ? "ရရန်ရှိ" : "ပေးရန်ရှိ"}</td><td className="font-bold">{money(row.amount, row.currency)}</td><td><StatusButton label={row.status === "paid" ? "ဆပ်ပြီး" : "မဆပ်ရသေး"} active={row.status === "paid"} onClick={() => request("PATCH", { entity: "debt", id: row.id, status: row.status === "paid" ? "unpaid" : "paid" })} /></td><td><DeleteButton onClick={() => request("DELETE", { entity: "debt", id: row.id })} /></td></tr>)}</tbody></table>
              </div>
              {debts.length === 0 && <Empty text="ရွေးထားသော အကြွေးမှတ်တမ်း မရှိပါ။" />}
            </HistoryPanel>
          </div>
        </>
      )}

      {view === "lottery" && (
        <>
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            <Summary label="MMK ထိုးဖိုး" value={data.lotterySummary.bet.MMK} currency="MMK" />
            <Summary label="MMK ပေါက်ငွေ" value={data.lotterySummary.win.MMK} currency="MMK" tone="emerald" />
            <Summary label="THB ထိုးဖိုး" value={data.lotterySummary.bet.THB} currency="THB" />
            <Summary label="THB ပေါက်ငွေ" value={data.lotterySummary.win.THB} currency="THB" tone="emerald" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <form onSubmit={addLottery} className="card grid h-fit gap-4 xl:sticky xl:top-8">
              <div><h2 className="text-lg font-bold">ချဲစာရင်း 2D/3D</h2><p className="text-xs text-slate-500">ထိုးကြေးနှင့် ရလဒ်စာရင်း</p></div>
              <label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option>2D</option><option>3D</option><option>Other</option></select></label>
              <label className="form-label">ငွေကြေး<select name="currency" value={lotteryCurrency} onChange={(event) => setLotteryCurrency(event.target.value as "MMK" | "THB")} className="field mt-1"><option>MMK</option><option>THB</option></select></label>
              <label className="form-label">နုတ်ယူမည့် Wallet<select name="walletId" className="field mt-1" required><option value="">Wallet ရွေးပါ</option>{lotteryWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {money(wallet.balance, wallet.currency)}</option>)}</select></label>
              <label className="form-label">ထိုးဂဏန်း<input name="number" inputMode="numeric" className="field mt-1 text-lg font-bold tracking-widest" placeholder="ဥပမာ - 12" required /></label>
              <label className="form-label">ထိုးကြေး<input name="betAmount" type="number" min="1" step="any" className="field mt-1" placeholder="0" required /></label>
              <label className="form-label">ပေါက်ကြေးဆ<input name="odds" type="number" min="1" step="any" defaultValue="80" className="field mt-1" required /></label>
              <label className="form-label">နေ့စွဲ<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label>
              <button disabled={busy} className="btn-primary py-3">စာရင်းသွင်းမည်</button>
            </form>

            <HistoryPanel title="2D/3D မှတ်တမ်း" filter={<select value={lotteryFilter} onChange={(event) => setLotteryFilter(event.target.value)} className="field max-w-40"><option value="all">အားလုံး</option><option value="pending">စောင့်ဆိုင်းဆဲ</option><option value="won">ပေါက်သည်</option><option value="lost">မပေါက်ပါ</option></select>}>
              <div className="space-y-3 md:hidden">
                {lotteries.map((row) => <MobileRecord key={row.id} title={`${row.type} — ${row.number}`} subtitle={row.date} onDelete={() => request("DELETE", { entity: "lottery", id: row.id })}>
                  <Line label="Wallet" value={walletName(row.walletId)} />
                  <Line label="ထိုးကြေး" value={money(row.betAmount, row.currency)} />
                  <Line label="ပေါက်နိုင်ငွေ" value={money(Number(row.betAmount) * Number(row.odds), row.currency)} strong />
                  <LotteryActions row={row} request={request} />
                </MobileRecord>)}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-3">နေ့စွဲ</th><th>Wallet</th><th>အမျိုးအစား</th><th>ဂဏန်း</th><th>ထိုးကြေး</th><th>ပေါက်နိုင်ငွေ</th><th>အခြေအနေ</th><th /></tr></thead><tbody>{lotteries.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="p-3">{row.date}</td><td>{walletName(row.walletId)}</td><td>{row.type}</td><td className="font-mono text-lg font-black">{row.number}</td><td>{money(row.betAmount, row.currency)}</td><td className="font-bold text-emerald-600">{money(Number(row.betAmount) * Number(row.odds), row.currency)}</td><td><LotteryActions row={row} request={request} /></td><td><DeleteButton onClick={() => request("DELETE", { entity: "lottery", id: row.id })} /></td></tr>)}</tbody></table>
              </div>
              {lotteries.length === 0 && <Empty text="ရွေးထားသော 2D/3D မှတ်တမ်း မရှိပါ။" />}
            </HistoryPanel>
          </div>
        </>
      )}
    </div>
  );
}

function HistoryPanel({ title, children, filter, onPrint }: { title: string; children: React.ReactNode; filter?: React.ReactNode; onPrint?: () => void }) {
  return <section className="card min-w-0"><div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4"><h2 className="font-bold">{title}</h2><div className="flex items-center gap-2">{filter}{onPrint && <button onClick={onPrint} className="btn-secondary flex items-center gap-2 text-sm"><Printer size={16} /> Print / PDF</button>}</div></div>{children}</section>;
}

function Summary({ label, value, currency, tone = "slate" }: { label: string; value: number; currency: string; tone?: "slate" | "emerald" | "rose" }) {
  const classes = tone === "emerald" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : tone === "rose" ? "text-rose-700 bg-rose-50 border-rose-100" : "text-slate-800 bg-white border-slate-200";
  return <div className={`rounded-2xl border p-4 ${classes}`}><p className="text-[11px] font-bold opacity-70">{label}</p><p className="mt-2 text-lg font-black sm:text-xl">{money(value, currency)}</p></div>;
}

function MobileRecord({ title, subtitle, children, onDelete }: { title: string; subtitle: string; children: React.ReactNode; onDelete: () => void }) {
  return <article className="rounded-2xl border border-slate-200 p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="font-bold">{title}</h3><p className="text-xs text-slate-400">{subtitle}</p></div><DeleteButton onClick={onDelete} /></div><div className="space-y-2">{children}</div></article>;
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className={`text-right ${strong ? "font-bold text-emerald-600" : "font-medium"}`}>{value}</span></div>;
}

function StatusButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{label}</button>;
}

function LotteryActions({ row, request }: { row: Row; request: (method: string, body: unknown) => Promise<boolean> }) {
  return <div className="flex flex-wrap gap-1"><button onClick={() => request("PATCH", { entity: "lottery", id: row.id, status: "won" })} className={`rounded-lg px-2 py-1 text-xs font-bold ${row.status === "won" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"}`}>ပေါက်</button><button onClick={() => request("PATCH", { entity: "lottery", id: row.id, status: "lost" })} className={`rounded-lg px-2 py-1 text-xs font-bold ${row.status === "lost" ? "bg-red-600 text-white" : "bg-red-100 text-red-700"}`}>မပေါက်</button><button onClick={() => request("PATCH", { entity: "lottery", id: row.id, status: "pending" })} className={`rounded-lg px-2 py-1 text-xs font-bold ${row.status === "pending" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>စောင့်ဆိုင်း</button></div>;
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 size={16} /></button>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-400">{text}</div>;
}
