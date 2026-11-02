/** Fixed destinations, never a user-provided URL or path. */
export const demoEntryDestinations = {
  dashboard: "/dashboard",
  orders: "/dashboard/orders",
  kitchen: "/kitchen",
  floor: "/dashboard/floor",
  menu: "/dashboard/menu",
  ember: "/dashboard",
} as const;

export function demoEntryDestination(input: string | null): string {
  if (input && Object.prototype.hasOwnProperty.call(demoEntryDestinations, input)) {
    return demoEntryDestinations[input as keyof typeof demoEntryDestinations];
  }
  return demoEntryDestinations.dashboard;
}
