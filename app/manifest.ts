import type { MetadataRoute } from "next";
import { WALLET_NOTE_BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: WALLET_NOTE_BRAND.name,
    short_name: WALLET_NOTE_BRAND.name,
    description: WALLET_NOTE_BRAND.description,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#020617",
    orientation: "portrait-primary",
    icons: [
      {
        src: WALLET_NOTE_BRAND.logoProxy,
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: WALLET_NOTE_BRAND.logoProxy,
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
