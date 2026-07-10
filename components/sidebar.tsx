"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, WalletCards, ArrowLeftRight, Dices, Settings, LogOut, Users, Sheet, Sparkles } from "lucide-react";

const links = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/premium", "Premium", Sparkles],
  ["/wallet", "Wallet", WalletCards],
  ["/exchange", "Exchange", ArrowLeftRight],
  ["/lottery", "Lottery", Dices],
  ["/connect-sheet", "My Sheet", Sheet],
  ["/settings", "Settings", Settings],
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  const navLinks = links.map(([href, label, Icon]) => (
    <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${pathname.startsWith(href) ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-900"}`}>
      <Icon size={20}/>{label}
    </Link>
  ));

  return <>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 overflow-y-auto bg-slate-950 p-5 text-white lg:block">
      <div className="mb-8 text-2xl font-bold">Wallet Note</div>
      <nav className="space-y-2 pb-20">
        {navLinks}
        <Link href="/admin/users" className={`flex items-center gap-3 rounded-xl px-3 py-3 ${pathname.startsWith("/admin") ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-900"}`}><Users size={20}/>Admin Users</Link>
      </nav>
      <button onClick={logout} className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-slate-300 hover:bg-slate-900"><LogOut size={20}/>Logout</button>
    </aside>

    <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 p-2 text-white lg:hidden">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="font-bold">Wallet Note</span>
        <button onClick={logout} className="rounded-lg p-2 text-slate-300"><LogOut size={18}/></button>
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-1">
        {links.map(([href, label, Icon]) => <Link key={href} href={href} className={`flex min-w-24 flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs ${pathname.startsWith(href) ? "bg-white text-slate-950" : "text-slate-300"}`}><Icon size={17}/>{label}</Link>)}
      </nav>
    </div>
  </>;
}
