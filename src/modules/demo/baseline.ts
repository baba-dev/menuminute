import demoMenu from "@/data/demo/demo-menu.json";
import { menuDocumentSchema } from "@/modules/menu-product/contracts";

import { DEMO_IDS } from "./ids";

export { DEMO_IDS };

export type DemoBaseline = {
  menu: unknown;
  tables: Array<{ id: string; number: string; label: string; capacity: number }>;
  translations: Record<string, unknown>;
  outlet: { name: string; description: string; city: string };
};

/** Dining-room layout restored on every reset. */
const tables = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `demo-table-${i + 1}`,
    number: String(i + 1),
    label: `Table ${i + 1}`,
    capacity: i < 4 ? 2 : 4,
  })),
  { id: "demo-table-9", number: "9", label: "Window booth", capacity: 6 },
  { id: "demo-table-10", number: "10", label: "Chef's counter", capacity: 4 },
  { id: "demo-table-11", number: "11", label: "Garden terrace", capacity: 6 },
  { id: "demo-table-12", number: "12", label: "Private dining", capacity: 10 },
];

/** Validated baseline passed to app_private.reset_demo_outlet. Parsing fails closed in tests/CI. */
export function buildDemoBaseline(): DemoBaseline {
  const menu = menuDocumentSchema.parse(demoMenu);
  return {
    menu,
    tables,
    translations: {},
    outlet: {
      name: "Spice Route Kitchen",
      description:
        "A sample restaurant with 236 dishes from every corner of India and beyond. Demo data only; the menu resets every 30 minutes.",
      city: "Demonstration",
    },
  };
}
