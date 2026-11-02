import type { PublicOutletProfile } from "./service";

/** Only public, guest-facing details are admitted here; malformed links are omitted. */
export function publicOutletDetails(profile: PublicOutletProfile | null | undefined) {
  const text = (value: string | null | undefined) => value?.trim() || null;
  const city = text(profile?.city);
  const address = [profile?.addressLine1, profile?.addressLine2, city, profile?.state, profile?.postalCode]
    .map(text)
    .filter((value): value is string => Boolean(value))
    .join(", ");
  const hasAddress = Boolean(text(profile?.addressLine1) || city);
  const latitude = profile?.latitude;
  const longitude = profile?.longitude;
  const hasCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  const directionsHref = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : hasAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null;

  const phone = text(profile?.phone);
  const digits = phone?.replace(/[^0-9]/g, "") ?? "";
  const phoneHref =
    phone && /^[+0-9 ()-]+$/.test(phone) && digits.length >= 7 && digits.length <= 16
      ? "tel:" + (phone.startsWith("+") ? "+" : "") + digits
      : null;
  const email = text(profile?.email);
  const emailHref =
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "mailto:" + email : null;
  let websiteHref: string | null = null;
  try {
    if (profile?.website) {
      const url = new URL(profile.website);
      if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password)
        websiteHref = url.href;
    }
  } catch {
    // Invalid stored URLs should never break the public menu.
  }
  return {
    address: hasAddress ? address : null,
    phoneHref,
    emailHref,
    websiteHref,
    directionsHref,
  };
}
