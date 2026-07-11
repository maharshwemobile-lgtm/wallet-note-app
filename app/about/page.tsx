import Shell from "@/components/shell";
import { WALLET_NOTE_BRAND } from "@/lib/brand";
import { Gift, HeartHandshake, MessageCircle, ShieldCheck, Sparkles, WalletCards } from "lucide-react";

const developerPhoto = "https://media.licdn.com/dms/image/v2/D5603AQETYFWFAxG7Hg/profile-displayphoto-shrink_200_200/B56ZYFClniGcAY-/0/1743841287159?e=2147483647&v=beta&t=vufwpqzyQ0tJYvTjB4xsCm2LfiZEcEJB1ePl4D9jcvM";

export default function AboutPage() {
  return (
    <Shell title="About Us">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-700 p-6 text-white md:grid-cols-[1.2fr_.8fr] md:p-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[.2em] text-cyan-100">
                <Sparkles size={14} /> Wallet Note
              </div>
              <div>
                <h2 className="text-3xl font-black leading-tight sm:text-4xl">Record. Organize. Grow.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-cyan-50/90 sm:text-base">
                  Wallet Note is built to help local businesses record wallets, remittance, debt, lottery entries, dealer settlement, and daily finance operations in one simple workspace.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoCard icon={<WalletCards size={19} />} label="Finance" value="Wallet + Ledger" />
                <InfoCard icon={<ShieldCheck size={19} />} label="Database" value="PostgreSQL Core" />
                <InfoCard icon={<HeartHandshake size={19} />} label="Support" value="Local Business" />
              </div>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-2xl shadow-cyan-950/30">
              <img src={WALLET_NOTE_BRAND.logoUrl} alt="Wallet Note Logo" className="h-auto w-full rounded-2xl object-contain" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <img src={developerPhoto} alt="Khun Myint Aung" className="h-28 w-28 rounded-full border-4 border-cyan-100 object-cover shadow-lg" />
              <span className="mt-4 rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[.16em] text-cyan-700">Developer</span>
              <h3 className="mt-3 text-2xl font-black text-slate-900">Khun Myint Aung</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">Developed by Khun Myint Aung</p>
              <a href="https://t.me/Mylifemychoice68" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/20 hover:bg-blue-700">
                <MessageCircle size={18} /> Telegram @Mylifemychoice68
              </a>
            </div>
          </article>

          <article className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <Gift size={23} />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Please Donate</span>
                <h3 className="mt-1 text-2xl font-black text-slate-900">Support Mahar Shwe Mobile</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Choose local KBZ Pay, worldwide crypto, or Thailand PromptPay donation method. Your support helps keep Mahar Shwe Mobile projects improving for local shops and customers.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <DonationMethod title="KBZ Pay" description="Local Myanmar donation method" />
              <DonationMethod title="Crypto" description="Worldwide support method" />
              <DonationMethod title="PromptPay" description="Thailand donation method" />
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-white/80 p-4 text-sm text-slate-600">
              For current donation account details, please contact Telegram <a href="https://t.me/Mylifemychoice68" target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline">@Mylifemychoice68</a>.
            </div>
          </article>
        </section>
      </div>
    </Shell>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
    <div className="text-cyan-100">{icon}</div>
    <span className="mt-2 block text-[10px] font-bold uppercase tracking-[.15em] text-cyan-100/75">{label}</span>
    <b className="mt-1 block text-sm">{value}</b>
  </div>;
}

function DonationMethod({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
    <b className="block text-slate-900">{title}</b>
    <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
  </div>;
}
