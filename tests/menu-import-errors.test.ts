import { expect, it } from "vitest";
import { importDomainError } from "../src/modules/menu-import/errors";

/** Shaped like the driver error Drizzle wraps: the RAISE text and SQLSTATE sit on `cause`. */
const refused = (message: string, code: string) =>
  new Error("Failed query", { cause: Object.assign(new Error(message), { code }) });
const caught = (error: unknown) => {
  try {
    importDomainError(error);
  } catch (thrown) {
    return thrown as { message: string; code?: string; statusCode?: number };
  }
};

it("gives each import refusal its own sentence and keeps the SQLSTATE's status", () => {
  expect(caught(refused("Too many active imports", "22023"))).toMatchObject({
    message: expect.stringContaining("You already have 5 unfinished imports"),
    code: "IMPORT_ACTIVE_LIMIT",
    statusCode: 422,
  });
  expect(caught(refused("Hourly import source limit exceeded", "22023"))).toMatchObject({
    message: expect.stringContaining("30 photos in the last hour"),
    statusCode: 422,
  });
  expect(caught(refused("Stale import revision", "40001"))).toMatchObject({
    message: expect.stringContaining("changed in another tab or device"),
    statusCode: 409,
  });
  // A refusal on authority still answers 403; only the wording is specific.
  expect(caught(refused("Import not collecting", "42501"))).toMatchObject({
    message: expect.stringContaining("no longer accepts photos"),
    statusCode: 403,
  });
  expect(caught(refused("Daily import engine limit", "54000"))).toMatchObject({
    code: "IMPORT_DAILY_LIMIT",
    statusCode: 503,
  });
});

it("never mentions currency or repricing for an import refusal", () => {
  for (const message of ["Too many active imports", "Invalid source", "Import already submitted"])
    expect(caught(refused(message, "22023"))?.message).not.toMatch(/currency|repricing/i);
});

it("leaves unknown database errors to the general mapping", () => {
  expect(caught(refused("Forbidden", "42501"))).toMatchObject({ statusCode: 403 });
  const unknown = new Error("boom");
  expect(caught(unknown)).toBe(unknown);
});
