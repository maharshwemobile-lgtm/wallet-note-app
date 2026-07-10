"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, WalletCards, ArrowLeftRight, Dices, Settings, LogOut, Users, Sheet } from "lucide-react";

const links = [
  ["/dashboard", "Dashboard Overview", LayoutDashboard],
  ["/wallet", "Wallet Management", WalletCards],
  ["/exchange", "Currency Exchange", ArrowLeftRight],
  ["/lottery", "3D Lottery", Dices],
  ["/connect-sheet", "My Google Sheet", Sheet],
  ["/settings", "Settings", Settings],
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }
  return <aside className="fixed inset-y-0 left-0 w-72 bg-slate-950 p-5 text-white">
    <div className="mb-8 text-2xl font-bold">Wallet Note</div>
    <nav className="space-y-2">
      {links.map(([href, label, Icon]) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${pathname.startsWith(href) ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-900"}`}><Icon size={20}/>{label}</Link>)}
      <Link href="/admin/users" className={`flex items-center gap-3 rounded-xl px-3 py-3 ${pathname.startsWith("/admin") ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-900"}`}><Users size={20}/>Admin Users</Link>
    </nav>
    <button onClick={logout} className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-slate-300 hover:bg-slate-900"><LogOut size={20}/>Logout</button>
  </aside>;
}
