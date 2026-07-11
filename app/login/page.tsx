"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/brand-logo";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    if (message) setError(message);
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity: form.get("identity"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Login failed");
      location.href = "/dashboard";
    } catch {
      setError("Login failed. Please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-7 shadow-2xl sm:p-8">
        <div className="mb-7 rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <BrandLogo />
        </div>

        <a
          href="/api/auth/google"
          className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          <span className="text-lg font-bold">G</span>
          Continue with Google
        </a>

        <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-4">
          <input name="identity" className="field" placeholder="Email or username" required />
          <input name="password" type="password" className="field" placeholder="Password" required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="btn-primary w-full py-3">
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <p className="text-center text-sm text-slate-500">
            No account?{" "}
            <Link className="font-semibold text-slate-900" href="/register">
              Create one
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
