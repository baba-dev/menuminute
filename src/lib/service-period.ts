/** Restaurant-local service copy. No order activity is inferred from the clock. */
export function outletHour(timezone: string, date: Date = new Date()): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(date)
    );
  } catch {
    return date.getUTCHours();
  }
}

export function getServicePeriodText(hour: number): {
  period: string;
  greeting: string;
  subtext: string;
} {
  if (hour >= 6 && hour < 11)
    return {
      period: "Morning",
      greeting: "Good morning",
      subtext: "Prepare your menu and check today's availability.",
    };
  if (hour >= 11 && hour < 15)
    return {
      period: "Midday",
      greeting: "Good afternoon",
      subtext: "Review orders and keep your published menu up to date.",
    };
  if (hour >= 15 && hour < 17)
    return {
      period: "Afternoon",
      greeting: "Good afternoon",
      subtext: "Update availability before your next service.",
    };
  if (hour >= 17 && hour < 22)
    return {
      period: "Evening",
      greeting: "Good evening",
      subtext: "Check your service queue and menu availability.",
    };
  return {
    period: "After hours",
    greeting: "Welcome back",
    subtext: "Review your workspace whenever you're ready.",
  };
}
