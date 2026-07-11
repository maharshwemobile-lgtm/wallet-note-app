import "./globals.css";
import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/pwa-register";
import { WALLET_NOTE_BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: WALLET_NOTE_BRAND.name,
    template: `%s | ${WALLET_NOTE_BRAND.name}`,
  },
  description: WALLET_NOTE_BRAND.description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: WALLET_NOTE_BRAND.logoProxy,
    apple: WALLET_NOTE_BRAND.logoProxy,
  },
  openGraph: {
    title: WALLET_NOTE_BRAND.name,
    description: WALLET_NOTE_BRAND.description,
    images: [WALLET_NOTE_BRAND.logoUrl],
  },
  appleWebApp: {
    capable: true,
    title: WALLET_NOTE_BRAND.name,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="my"><body><PwaRegister />{children}</body></html>;
}
