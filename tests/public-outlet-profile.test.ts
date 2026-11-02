import { describe, expect, it } from "vitest";
import { publicOutletDetails } from "@/modules/menu-product/public-outlet-profile";
import type { PublicOutletProfile } from "@/modules/menu-product/service";

const emptyProfile: PublicOutletProfile = {
  description: null,
  phone: null,
  email: null,
  website: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  country: "IN",
  latitude: null,
  longitude: null,
  primaryColor: null,
  secondaryColor: null,
};

describe("guest-facing outlet contact details", () => {
  it("hides contact actions when nothing is configured", () => {
    expect(publicOutletDetails(emptyProfile)).toEqual({
      address: null,
      phoneHref: null,
      emailHref: null,
      websiteHref: null,
      directionsHref: null,
    });
  });

  it("renders correct public calls, email, website and map coordinates", () => {
    const data = publicOutletDetails({
      ...emptyProfile,
      addressLine1: "Main Road",
      city: "Pilani",
      state: "Rajasthan",
      latitude: 28.36,
      longitude: 75.6,
      phone: "+91 98765 43210",
      email: "hello@example.com",
      website: "https://example.com/menu",
    });
    expect(data.address).toBe("Main Road, Pilani, Rajasthan");
    expect(data.phoneHref).toBe("tel:+919876543210");
    expect(data.emailHref).toBe("mailto:hello@example.com");
    expect(data.websiteHref).toBe("https://example.com/menu");
    expect(data.directionsHref).toContain("28.36,75.6");
  });

  it("uses a city for directions when coordinates are missing", () => {
    const data = publicOutletDetails({ ...emptyProfile, city: "Pilani" });
    expect(data.directionsHref).toContain("Pilani");
  });

  it("rejects unsafe or incomplete public links", () => {
    const data = publicOutletDetails({
      ...emptyProfile,
      website: "javascript:alert(1)",
      email: "not-an-email",
      phone: "123",
      latitude: 999,
      longitude: 75.6,
    });
    expect(data.websiteHref).toBeNull();
    expect(data.emailHref).toBeNull();
    expect(data.phoneHref).toBeNull();
    expect(data.directionsHref).toBeNull();
  });
});
