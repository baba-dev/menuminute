/** Loaded via next/font in the root layout; self-hosted at build time with no browser font CDN. */
export const PRINT_FONTS = [
  { id: "dm", name: "DM Sans", description: "Minimal & clear" },
  { id: "playfair", name: "Playfair Display", description: "Editorial & elegant" },
  { id: "bricolage", name: "Bricolage Grotesque", description: "Bold & friendly" },
  { id: "bebas", name: "Bebas Neue", description: "Confident display" },
  { id: "kalam", name: "Kalam", description: "Handwritten & personal" },
] as const;

export type PrintFont = (typeof PRINT_FONTS)[number]["id"];
