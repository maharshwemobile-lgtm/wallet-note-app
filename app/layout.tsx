import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Wallet Note", description: "Agent wallet, currency exchange and 3D lottery dashboard" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
