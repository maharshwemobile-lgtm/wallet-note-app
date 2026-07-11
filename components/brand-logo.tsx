"use client";

import { useState } from "react";
import { WALLET_NOTE_BRAND } from "@/lib/brand";

export default function BrandLogo({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-black text-white shadow-lg shadow-cyan-500/20">
          W
        </div>
        {!compact && (
          <div className="min-w-0">
            <div className="truncate text-lg font-black text-slate-950 dark:text-white">Wallet Note</div>
            <div className="truncate text-[11px] font-semibold text-slate-500">Record. Organize. Grow.</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={WALLET_NOTE_BRAND.logoProxy}
      alt="Wallet Note Logo"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
