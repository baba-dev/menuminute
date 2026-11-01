import {
  getResolvedAppearance,
  setAppearancePreference,
  type AppearancePreference,
  type ResolvedAppearance,
} from "./appearance-store";

/** A viewport-wide circle reveal, anchored to the control that initiated the change. */
const DURATION_MS = 550;
let transitionInProgress = false;

function resolveTarget(preference: AppearancePreference): ResolvedAppearance {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Uses the existing appearance store for all writes and persistence. The visual effect is
 * optional: reduced-motion users and browsers without View Transitions switch instantly.
 */
export function setAppearanceWithTransition(
  preference: AppearancePreference,
  origin?: Element | null
): void {
  if (typeof window === "undefined") return;
  const before = getResolvedAppearance();
  if (
    before === resolveTarget(preference) ||
    transitionInProgress ||
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    setAppearancePreference(preference);
    return;
  }

  const bounds = origin?.getBoundingClientRect();
  const x = bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2;
  const y = bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );
  const root = document.documentElement;
  transitionInProgress = true;
  root.dataset.mmThemeTransition = "active";
  let viewTransition: ViewTransition;
  try {
    // The appearance store updates the root attribute synchronously, inside the snapshot.
    viewTransition = document.startViewTransition(() => setAppearancePreference(preference));
  } catch {
    transitionInProgress = false;
    delete root.dataset.mmThemeTransition;
    setAppearancePreference(preference);
    return;
  }

  void viewTransition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: DURATION_MS,
          easing: "ease-in-out",
          fill: "both",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    })
    .catch(() => {
      // The new theme is already applied even if the animation is cancelled.
    });
  void viewTransition.finished.then(
    () => {
      transitionInProgress = false;
      delete root.dataset.mmThemeTransition;
    },
    () => {
      transitionInProgress = false;
      delete root.dataset.mmThemeTransition;
    }
  );
}

export function toggleAppearanceWithTransition(origin?: Element | null): void {
  setAppearanceWithTransition(getResolvedAppearance() === "dark" ? "light" : "dark", origin);
}
