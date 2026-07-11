"use client";

import { FormEvent, useEffect, useState } from "react";

export default function AdminUsersClient() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Users ဖွင့်မရပါ");
    setUsers(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        username: form.get("username"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role"),
        maxBetPerNumber: Number(form.get("maxBetPerNumber") || 0),
        maxBetPerDraw: Number(form.get("maxBetPerDraw") || 0),
      }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Create failed");
    setMessage(data.bettingLink ? `Betting link: ${data.bettingLink}` : "User created");
    event.currentTarget.reset();
    await load();
  }

  async function update(userId: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...payload }),
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Update failed");
    else setMessage(data.bettingLink ? `Updated: ${data.bettingLink}` : "Updated");
    await load();
  }

  if (error) return <div className="card text-red-600">{error}</div>;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={createUser} className="card grid h-fit gap-4">
        <div>
          <h2 className="text-lg font-black">End User / Agent အသစ်</h2>
          <p className="text-xs text-slate-500">ချဲထိုးသား link ထုတ်ရန် End User အဖြစ်ဖန်တီးပါ။</p>
        </div>
        {message && <div className="rounded-xl bg-slate-50 p-3 text-xs break-all">{message}</div>}
        <label className="form-label">အမည်<input name="name" className="field mt-1" required /></label>
        <label className="form-label">Username<input name="username" className="field mt-1" required /></label>
        <label className="form-label">Email optional<input name="email" type="email" className="field mt-1" /></label>
        <label className="form-label">Password optional<input name="password" type="password" className="field mt-1" /></label>
        <label className="form-label">Role<select name="role" className="field mt-1"><option value="end_user">End User / ချဲထိုးသား</option><option value="agent">Agent Staff</option></select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="form-label">Max/Number<input name="maxBetPerNumber" type="number" min="0" className="field mt-1" defaultValue="0" /></label>
          <label className="form-label">Max/Draw<input name="maxBetPerDraw" type="number" min="0" className="field mt-1" defaultValue="0" /></label>
        </div>
        <button className="btn-primary py-3">Create User</button>
      </form>

      <section className="card overflow-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Name</th><th>Username</th><th>Role</th><th>Status</th><th>Betting Link</th><th>Limits</th><th>Action</th></tr></thead>
          <tbody>{users.map((user) => <tr className="border-b last:border-0" key={user.id}>
            <td className="p-2 font-semibold">{user.name}<div className="text-xs text-slate-400">{user.email}</div></td>
            <td>{user.username}</td>
            <td>{user.role}</td>
            <td>{user.status}</td>
            <td className="max-w-[260px] truncate text-xs">{user.bettingLink || "-"}</td>
            <td className="text-xs">No: {user.maxBetPerNumber || 0}<br/>Draw: {user.maxBetPerDraw || 0}</td>
            <td className="space-x-2">
              <button className="btn-secondary" onClick={() => update(user.id, { status: user.status === "Active" ? "Suspended" : "Active" })}>{user.status === "Active" ? "Suspend" : "Activate"}</button>
              {user.role === "end_user" && <button className="btn-secondary" onClick={() => update(user.id, { linkEnabled: !user.linkEnabled })}>{user.linkEnabled ? "Disable Link" : "Enable Link"}</button>}
            </td>
          </tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
