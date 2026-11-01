import type { AppearancePreference } from "@/components/menu-product/appearance-store";

/**
 * UI-only commands are recognized deterministically, never inferred from an AI answer.
 * An entire prompt must be an explicit instruction so questions about themes still go to Ember.
 */
export type AppearanceCommand = AppearancePreference | "toggle";
export function parseAppearanceCommand(prompt: string): AppearanceCommand | null {
  if (prompt.length > 120) return null;
  const command = prompt
    .toLocaleLowerCase()
    .replace(/[,.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:hey|hi|hello) )?ember /, "")
    .replace(/^please /, "")
    .replace(/ please$/, "");

  if (
    /^(?:toggle|flip|switch)(?: the)? (?:color |colour )?(?:theme|mode|appearance|dark mode|light mode)$/.test(
      command
    )
  )
    return "toggle";
  if (
    /^(?:turn|switch) off (?:the )?dark (?:mode|theme)$/.test(command) ||
    /^dark (?:mode|theme) off$/.test(command)
  )
    return "light";
  if (/^(?:turn|switch) on (?:the )?dark (?:mode|theme)$/.test(command)) return "dark";
  if (
    /^(?:(?:switch to|change to|set(?: the)?(?: color| colour)? (?:mode|theme|appearance) to|use|follow) (?:the |my )?(?:system|device|os)(?: (?:mode|theme|appearance|settings|preference))?|(?:reset|restore) (?:the )?(?:theme|appearance|mode) to (?:system|default)|follow (?:my |the )?system (?:settings|preference))$/.test(command)
  ) return "system";

  const explicit =
    /^(?:switch to|change to|change (?:my |the )?(?:(?:color|colour) )?(?:theme|mode|appearance) to|set (?:the )?(?:(?:color|colour) )?(?:theme|mode|appearance) to|set|use|enable|activate|turn on|go|make (?:it|the app)) (?:the )?(dark|light)(?: (?:mode|theme))?$/.exec(
      command
    );
  if (explicit) return explicit[1] as "dark" | "light";
  if (/^(?:dark|light) (?:mode|theme)$/.test(command))
    return command.startsWith("dark") ? "dark" : "light";
  return null;
}
