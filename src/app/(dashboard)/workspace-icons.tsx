import {
  BarChart3,
  Bell,
  Building2,
  ChefHat,
  LayoutDashboard,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Table2,
  Utensils,
  UtensilsCrossed,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { PaletteIcon } from "@/modules/dashboard/palette-model";

const icons: Record<PaletteIcon, LucideIcon> = {
  layout: LayoutDashboard,
  orders: ShoppingBag,
  pos: ReceiptText,
  kitchen: ChefHat,
  floor: Table2,
  menu: UtensilsCrossed,
  qr: QrCode,
  reports: BarChart3,
  organization: Building2,
  settings: Settings,
  plus: Plus,
  search: Search,
  sparkles: Sparkles,
  bell: Bell,
  volume: Volume2,
  dish: Utensils,
};

export function WorkspaceIcon({
  name,
  size = 19,
  strokeWidth = 1.9,
}: {
  name: PaletteIcon;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = icons[name];
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}
