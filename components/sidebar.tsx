"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  CircleUserRound,
  Dices,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Settings,
  Sheet,
  Users,
  WalletCards,
} from "lucide-react";
import BrandLogo from "@/components/brand-logo";

const links = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/accounts", "ငွေစာရင်းအကောင့်များ", WalletCards],
  ["/remittance", "ငွေလွှဲ/ငွေထုတ်", BookOpenCheck],
  ["/debts", "အကြွေးစာရင်း", HandCoins],
  ["/lottery", "ချဲစာရင်း 2D/3D", Dices],
  ["/connect-sheet", "My Sheet", Sheet],
  ["/settings", "Settings", Settings],
  ["/about", "About Us", CircleUserRound],
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 overflow-y-auto border-r border-slate-800 bg-slate-950 p-5 text-white lg:flex lg:flex-col">
        <Link href="/dashboard" className="mb-7 block rounded-3xl bg-white p-3 shadow-xl shadow-cyan-950/20 transition hover:-translate-y-0.5">
          <BrandLogo />
        </Link>

        <nav className="flex-1 space-y-2 pb-6">
          {links.map(([href, label, Icon]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            );
          })}

          <Link
            href="/admin/users"
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
              pathname.startsWith("/admin")
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-300 hover:bg-slate-900 hover:text-white"
            }`}
          >
            <Users size={20} />
            <span>Admin Users</span>
          </Link>
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
        >
          <LogOut size={20} />
          Logout
        </button>
      </aside>

      <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <Link href="/dashboard" className="min-w-0 flex-1">
            <BrandLogo compact className="max-w-[180px]" />
          </Link>
          <button onClick={logout} className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-900 hover:text-white">
            <LogOut size={19} />
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          {links.map(([href, label, Icon]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-w-24 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                  active ? "bg-white text-slate-950" : "text-slate-300"
                }`}
              >
                <Icon size={17} />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
