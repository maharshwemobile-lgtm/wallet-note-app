"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SettingsClient() {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((response) => response.json()).then(setData);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rate: Number(form.get("rate")),
        multiplier: Number(form.get("multiplier")),
      }),
    });
    setMessage(response.ok ? "Saved" : "Save failed");
  }

  if (!data) return <div className="card">Loading...</div>;

  return (
    <div className="max-w-xl space-y-5">
      <section className="card space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Google Sheet</h2>
          <p className="mt-1 text-sm text-slate-500">Connect or change the Sheet used to save your records.</p>
        </div>
        <Link href="/connect-sheet" className="btn-secondary inline-block">Manage Google Sheet</Link>
      </section>

      <form onSubmit={submit} className="card space-y-4">
        <h2 className="text-lg font-semibold">Rates</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">1 THB equals how many MMK?</span>
          <input name="rate" type="number" min="0" defaultValue={data.thbToMmkRate || 0} className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">3D payout multiplier</span>
          <input name="multiplier" type="number" min="0" defaultValue={data.payoutMultiplier || 500} className="field" />
        </label>
        <button className="btn-primary">Save</button>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </form>
    </div>
  );
}
