"use client";

import { FormEvent, useEffect, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);

export default function PublicBetClient({ token }: { token: string }) {
  const [customer, setCustomer] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/public/bet/${token}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Link မမှန်ပါ");
        return data.customer;
      })
      .then(setCustomer)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Link မမှန်ပါ"));
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/public/bet/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.get("date"),
          type: form.get("type"),
          currency: form.get("currency"),
          number: form.get("number"),
          betAmount: Number(form.get("betAmount")),
          payoutMultiplier: Number(form.get("payoutMultiplier") || 80),
          note: form.get("note"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "မအောင်မြင်ပါ");
      setMessage("ချဲစာရင်း ပို့ပြီးပါပြီ။");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "မအောင်မြင်ပါ");
    } finally {
      setBusy(false);
    }
  }

  if (!customer) return <main className="mx-auto max-w-md p-4"><div className="card">{message || "ဖွင့်နေပါသည်..."}</div></main>;

  return (
    <main className="mx-auto max-w-md p-4">
      <form onSubmit={submit} className="card grid gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-black text-blue-700">Wallet Note</h1>
          <p className="mt-1 text-sm text-slate-500">{customer.name} အတွက် ချဲထိုး link</p>
        </div>
        {message && <div className="rounded-xl bg-slate-50 p-3 text-sm">{message}</div>}
        <div className="grid grid-cols-2 gap-3">
          <label className="form-label">အမျိုးအစား<select name="type" className="field mt-1"><option>2D</option><option>3D</option></select></label>
          <label className="form-label">ငွေကြေး<select name="currency" className="field mt-1"><option>MMK</option><option>THB</option></select></label>
        </div>
        <label className="form-label">ချဲထွက်မည့်နေ့<input name="date" type="date" defaultValue={today()} className="field mt-1" required /></label>
        <label className="form-label">ထိုးဂဏန်း<input name="number" inputMode="numeric" className="field mt-1 text-2xl font-black tracking-widest" required /></label>
        <label className="form-label">ထိုးငွေ<input name="betAmount" type="number" min="1" step="any" className="field mt-1" required /></label>
        <label className="form-label">ပေါက်ဆ<input name="payoutMultiplier" type="number" min="1" step="any" defaultValue="80" className="field mt-1" /></label>
        <label className="form-label">မှတ်ချက်<textarea name="note" className="field mt-1 min-h-20" /></label>
        {(customer.maxBetPerNumber > 0 || customer.maxBetPerDraw > 0) && <p className="text-xs text-slate-500">Limit: Number {customer.maxBetPerNumber || "-"}, Draw {customer.maxBetPerDraw || "-"}</p>}
        <button disabled={busy} className="btn-primary py-3">ချဲစာရင်း ပို့မည်</button>
      </form>
    </main>
  );
}
