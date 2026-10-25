import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/lib/errors";
import { grantFailureMessage } from "../src/modules/admin/grant-feedback";

describe("grant action feedback", () => {
  it("explains missing single-use authentication without exposing SQL", () => {
    const error = new Error("Failed query: SELECT privileged_data");
    Object.assign(error, {
      cause: new Error("Confirm a recent privileged action at /account/security first"),
    });
    const message = grantFailureMessage(error);
    expect(message).toContain("Account & Security");
    expect(message).not.toContain("SELECT");
  });

  it("explains already active overlapping grants", () => {
    expect(grantFailureMessage(new Error("Overlapping entitlement already exists"))).toContain(
      "overlapping grant"
    );
  });

  it("preserves the Kitchen Pro launch hold", () => {
    expect(
      grantFailureMessage(new Error("Kitchen Pro commercial activation is not approved"))
    ).toContain("blocked");
  });

  it("returns safe validated field errors", () => {
    expect(grantFailureMessage(new ValidationError("A valid future UTC entitlement window is required"))).toContain(
      "valid future UTC"
    );
  });

  it("never exposes unexpected database errors to clients", () => {
    const message = grantFailureMessage(new Error("password=secret query select * from accounts"));
    expect(message).toContain("could not be confirmed");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("accounts");
  });
});
