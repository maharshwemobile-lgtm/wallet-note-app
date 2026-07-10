import "./globals.css";
import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/pwa-register";

export const metadata: Metadata = {
  title: {
    default: "Wallet Note",
    template: "%s | Wallet Note",
  },
  description: "Personal wallet, remittance, debt and 2D/3D record management",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/wallet-note-icon.svg",
    apple: "/wallet-note-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Wallet Note",
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
