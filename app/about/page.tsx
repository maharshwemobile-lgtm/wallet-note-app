import Shell from "@/components/shell";
import { MessageCircle } from "lucide-react";

const developerPhoto =
  "https://media.licdn.com/dms/image/v2/D5603AQETYFWFAxG7Hg/profile-displayphoto-shrink_200_200/B56ZYFClniGcAY-/0/1743841287159?e=2147483647&v=beta&t=vufwpqzyQ0tJYvTjB4xsCm2LfiZEcEJB1ePl4D9jcvM";

export default function AboutPage() {
  return (
    <Shell title="About Us">
      <div className="mx-auto max-w-3xl py-4 sm:py-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="h-32 bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-700 sm:h-40" />

          <div className="relative px-5 pb-8 text-center sm:px-10 sm:pb-10">
            <div className="-mt-16 inline-flex rounded-full border-8 border-white bg-white shadow-xl sm:-mt-20">
              <img
                src={developerPhoto}
                alt="Khun Myint Aung"
                className="h-32 w-32 rounded-full object-cover sm:h-40 sm:w-40"
              />
            </div>

            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">Developer</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Khun Myint Aung
              </h2>
              <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
                Developed by Khun Myint Aung
              </p>
            </div>

            <div className="mx-auto my-7 h-px max-w-md bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

            <a
              href="https://t.me/Mylifemychoice68"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              <MessageCircle size={19} />
              Telegram @Mylifemychoice68
            </a>
          </div>
        </section>
      </div>
    </Shell>
  );
}
