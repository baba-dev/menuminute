import Link from "next/link";
import { BookOpenText, ClipboardCheck, ShoppingBasket } from "lucide-react";

const workspaces = [
  {
    key: "till",
    href: "/dashboard/pos",
    title: "Point of Sale",
    description: "Orders, cashier and billing",
    Icon: ShoppingBasket,
  },
  {
    key: "ledger",
    href: "/dashboard/pos/ledger",
    title: "The Ledger",
    description: "Review sales and documents",
    Icon: BookOpenText,
  },
  {
    key: "closing",
    href: "/dashboard/pos/closing",
    title: "Closing Desk",
    description: "Manage registers and shifts",
    Icon: ClipboardCheck,
  },
] as const;

export function PosNavigation({ active }: { active: "till" | "ledger" | "closing" }) {
  return (
    <nav className="pos-page-nav" aria-label="POS workspaces">
      {workspaces.map(({ key, href, title, description, Icon }) => (
        <Link key={key} href={href} aria-current={active === key ? "page" : undefined}>
          <span className="pos-nav-title">
            <Icon size={17} aria-hidden="true" />
            <strong>{title}</strong>
          </span>
          <small>{description}</small>
        </Link>
      ))}
    </nav>
  );
}
