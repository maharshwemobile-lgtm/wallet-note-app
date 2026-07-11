"use client";

import Link from "next/link";
import { useState } from "react";
import BrandLogo from "@/components/brand-logo";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.get("name"),
        email: f.get("email"),
        username: f.get("username"),
        password: f.get("password"),
      }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || "Registration failed");
    location.href = data.next || "/dashboard";
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-7 shadow-2xl sm:p-8">
        <div className="mb-7 rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <BrandLogo />
        </div>

        <h1 className="text-2xl font-black text-slate-950">Create Account</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">Create your Wallet Note account</p>

        <div className="space-y-4">
          <input name="name" className="field" placeholder="Full name" required />
          <input name="email" type="email" className="field" placeholder="Email" required />
          <input name="username" className="field" placeholder="Username" minLength={3} required />
          <input name="password" type="password" className="field" placeholder="Password (minimum 8 characters)" minLength={8} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="btn-primary w-full py-3">
            {loading ? "Creating..." : "Create Account"}
          </button>
          <p className="text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link className="font-semibold text-slate-900" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
