"use client";

import { WALLET_NOTE_BRAND } from "@/lib/brand";

export default function BrandLogo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <img
      src={WALLET_NOTE_BRAND.logoProxy}
      alt="Wallet Note Logo"
      className={compact
        ? `h-11 w-11 rounded-2xl bg-white object-cover shadow-sm ${className}`
        : `h-auto w-full rounded-2xl bg-white object-contain ${className}`}
    />
  );
}
