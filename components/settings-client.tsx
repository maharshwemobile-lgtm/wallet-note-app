"use client";

import { FormEvent, useEffect, useState } from "react";

export default function SettingsClient() {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Settings ဖွင့်မရပါ");
    setData(json);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Settings ဖွင့်မရပါ"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rate: Number(form.get("rate") || 0),
          multiplier: Number(form.get("multiplier") || 80),
          sheet: String(form.get("sheet") || ""),
          backupEnabled: form.get("backupEnabled") === "on",
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Save failed");
      setData(json.settings);
      setMessage("Settings သိမ်းပြီးပါပြီ။ Google Sheet သည် backup/export အတွက်သာ အသုံးပြုမည်။");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disconnectSheet: true, backupEnabled: false }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Disconnect failed");
      setData(json.settings);
      setMessage("Google Sheet backup connection ဖြုတ်ပြီးပါပြီ။");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="card">Settings ဖွင့်နေပါသည်...</div>;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={submit} className="card space-y-5">
        <div>
          <h2 className="text-xl font-black">Wallet Note Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Main database သည် PostgreSQL ဖြစ်ပြီး Google Sheet သည် backup/export အတွက်သာ ဖြစ်သည်။</p>
        </div>

        {message && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">{message}</div>}

        <section className="grid gap-4 rounded-2xl border border-slate-200 p-4">
          <div>
            <h3 className="font-bold">Default Rates</h3>
            <p className="text-xs text-slate-500">ငွေလဲနှုန်းနှင့် ချဲပေါက်ဆ default တန်ဖိုး</p>
          </div>
          <label className="form-label">THB to MMK default rate<input name="rate" type="number" step="any" min="0" defaultValue={data.thbToMmkRate || 0} className="field mt-1" /></label>
          <label className="form-label">Default lottery payout multiplier<input name="multiplier" type="number" step="any" min="1" defaultValue={data.defaultLotteryMultiplier || 80} className="field mt-1" /></label>
        </section>

        <section className="grid gap-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
          <div>
            <h3 className="font-bold text-blue-900">Google Sheet Backup / Export</h3>
            <p className="text-xs text-blue-700">Core app မလုပ်မီ Google Sheet မလိုအပ်တော့ပါ။ Backup သို့မဟုတ် export အတွက်သာ ချိတ်ပါ။</p>
          </div>
          <label className="form-label">Google Sheet URL or ID<input name="sheet" defaultValue={data.googleSheetId || ""} className="field mt-1" placeholder="https://docs.google.com/spreadsheets/d/..." /></label>
          <label className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-semibold"><input name="backupEnabled" type="checkbox" defaultChecked={Boolean(data.googleSheetBackupEnabled)} /> Backup/Export enabled</label>
          {data.googleSheetUrl && <a className="text-sm font-bold text-blue-700 underline" href={data.googleSheetUrl} target="_blank">Connected Sheet ဖွင့်မည်</a>}
        </section>

        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className="btn-primary px-5 py-3">Settings သိမ်းမည်</button>
          {data.googleSheetConnected && <button type="button" disabled={busy} onClick={disconnect} className="rounded-xl border border-red-200 px-5 py-3 font-bold text-red-600">Sheet ဖြုတ်မည်</button>}
        </div>
      </form>

      <aside className="card h-fit space-y-3 border-emerald-200 bg-emerald-50/50">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Current Storage</p>
        <h3 className="text-2xl font-black text-emerald-800">{data.storage}</h3>
        <p className="text-sm text-emerald-700">Login, Dashboard, Wallet, Debt, Remittance, Lottery အားလုံး PostgreSQL မှာ run နေပါသည်။</p>
        <div className="rounded-xl bg-white p-3 text-sm">
          <p className="font-bold">Google Sheet</p>
          <p className="text-slate-500">{data.googleSheetConnected ? "ချိတ်ထားသည်" : "မချိတ်ထားပါ"}</p>
          {data.googleSheetBackupEnabled && <p className="mt-1 text-blue-600">Backup enabled</p>}
        </div>
      </aside>
    </div>
  );
}
