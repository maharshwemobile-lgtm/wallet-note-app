"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, Dices, HandCoins, Info, LayoutDashboard, LogOut, Settings, Sheet, Users, WalletCards } from "lucide-react";
import { WALLET_NOTE_BRAND } from "@/lib/brand";

const links = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/accounts", "ငွေစာရင်းအကောင့်များ", WalletCards],
  ["/remittance", "ငွေလွှဲ/ငွေထုတ်", BookOpenCheck],
  ["/debts", "အကြွေးစာရင်း", HandCoins],
  ["/lottery", "ချဲစာရင်း 2D/3D", Dices],
  ["/connect-sheet", "My Sheet", Sheet],
  ["/settings", "Settings", Settings],
  ["/about", "About Us", Info],
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  return <>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 overflow-y-auto bg-slate-950 p-5 text-white lg:block">
      <div className="mb-8 rounded-3xl bg-white p-3 shadow-lg shadow-cyan-500/10">
        <img src={WALLET_NOTE_BRAND.logoUrl} alt="Wallet Note Logo" className="h-auto w-full rounded-2xl object-contain" />
      </div>
      <nav className="space-y-2 pb-24">
        {links.map(([href, label, Icon]) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${pathname.startsWith(href) ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-900"}`}><Icon size={20}/>{label}</Link>)}
        <Link href="/admin/users" className={`flex items-center gap-3 rounded-xl px-3 py-3 ${pathname.startsWith("/admin") ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-900"}`}><Users size={20}/>Admin Users</Link>
      </nav>
      <button onClick={logout} className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-slate-300 hover:bg-slate-900"><LogOut size={20}/>Logout</button>
    </aside>

    <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 p-2 text-white lg:hidden">
      <div className="mb-2 flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <img src={WALLET_NOTE_BRAND.logoUrl} alt="Wallet Note Logo" className="h-9 w-9 rounded-xl bg-white object-cover" />
          <span className="font-bold">{WALLET_NOTE_BRAND.name}</span>
        </div>
        <button onClick={logout} className="rounded-lg p-2 text-slate-300"><LogOut size={18}/></button>
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-1">
        {links.map(([href, label, Icon]) => <Link key={href} href={href} className={`flex min-w-28 flex-col items-center gap-1 rounded-lg px-3 py-2 text-[11px] ${pathname.startsWith(href) ? "bg-white text-slate-950" : "text-slate-300"}`}><Icon size={17}/><span className="whitespace-nowrap">{label}</span></Link>)}
      </nav>
    </div>
  </>;
}
