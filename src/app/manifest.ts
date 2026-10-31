import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MenuMinute — Restaurant Menus & Ordering",
    short_name: "MenuMinute",
    description:
      "Create, publish and browse restaurant menus with permanent QR codes and live ordering.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#f97316",
    orientation: "any",
    categories: ["business", "food", "productivity"],
    icons: [
      {
        src: "/brand/icons/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icons/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icons/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
