"use client";

import { useEffect, useState } from "react";

type Connection = {
  connected: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  connectedAt: string;
  serviceAccountEmail: string;
};

export default function SheetConnectionClient() {
  const [data, setData] = useState<Connection | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const response = await fetch("/api/sheet-connection", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load connection");
    setData(body);
  }

  useEffect(() => { void load().catch((err) => setError(err.message)); }, []);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/sheet-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet: form.get("sheet") }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) return setError(body.error || "Connection failed");
    setMessage(`Connected to ${body.title}`);
    await load();
  }

  async function disconnect() {
    if (!confirm("Disconnect this Google Sheet? Existing data will remain in the sheet.")) return;
    await fetch("/api/sheet-connection", { method: "DELETE" });
    setMessage("Google Sheet disconnected");
    await load();
  }

  if (!data) return <div className="card">Loading...</div>;

  return <div className="space-y-6">
    <div className="card space-y-4">
      <h2 className="text-xl font-semibold">Connect your own Google Sheet</h2>
      <ol className="list-decimal space-y-2 pl-5 text-slate-700">
        <li>Create a new Google Sheet in your Google Drive.</li>
        <li>Share it as <b>Editor</b> with this service account:</li>
      </ol>
      <div className="rounded-xl bg-slate-100 p-4 font-mono text-sm break-all">{data.serviceAccountEmail || "Service account email is not configured"}</div>
      <p className="text-sm text-slate-500">Wallet Note only stores this Sheet ID. Your service-account private key stays on the server and is never requested from users.</p>
    </div>

    <form onSubmit={connect} className="card space-y-4">
      <label className="block">
        <span className="mb-1 block font-medium">Google Sheet URL or Spreadsheet ID</span>
        <input name="sheet" className="field" placeholder="https://docs.google.com/spreadsheets/d/.../edit" required />
      </label>
      <button className="btn-primary" disabled={loading}>{loading ? "Connecting..." : data.connected ? "Connect a different Sheet" : "Connect Google Sheet"}</button>
      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-emerald-600">{message}</p>}
    </form>

    {data.connected && <div className="card space-y-3">
      <p className="font-semibold text-emerald-700">Connected</p>
      <a className="underline" href={data.spreadsheetUrl} target="_blank" rel="noreferrer">Open your Google Sheet</a>
      <p className="text-sm text-slate-500">Connected at: {data.connectedAt ? new Date(data.connectedAt).toLocaleString() : "Unknown"}</p>
      <div className="flex gap-3">
        <a href="/dashboard" className="btn-primary">Go to Dashboard</a>
        <button type="button" onClick={disconnect} className="btn-secondary">Disconnect</button>
      </div>
    </div>}
  </div>;
}
