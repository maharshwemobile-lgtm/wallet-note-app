"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dices, Home, LogOut, Settings, WalletCards } from "lucide-react";

const links = [
  ["/dashboard", "Home", Home],
  ["/wallet", "Wallet", WalletCards],
  ["/lottery", "3D", Dices],
  ["/settings", "Settings", Settings],
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  const navLinks = links.map(([href, label, Icon]) => {
    const active = pathname.startsWith(href) || (href === "/wallet" && pathname.startsWith("/exchange"));
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition ${
          active ? "bg-slate-900 text-white md:bg-white md:text-slate-950" : "text-slate-500 hover:bg-slate-100 md:text-slate-300 md:hover:bg-slate-900"
        }`}
      >
        <Icon size={20} />
        <span>{label}</span>
      </Link>
    );
  });

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-950 p-5 text-white md:flex">
        <div className="mb-8 px-2 text-2xl font-bold">Wallet Note</div>
        <nav className="space-y-2">{navLinks}</nav>
        <button
          onClick={logout}
          className="mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-slate-300 transition hover:bg-slate-900"
        >
          <LogOut size={20} />
          Logout
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="text-lg font-bold">Wallet Note</div>
        <button onClick={logout} className="rounded-lg p-2 text-slate-500" aria-label="Logout">
          <LogOut size={20} />
        </button>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white p-2 shadow-lg md:hidden">
        {navLinks}
      </nav>
    </>
  );
}
