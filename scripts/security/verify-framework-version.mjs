/** Keep security-patched framework artifacts aligned in frozen pnpm installs. */
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const lock = readFileSync("pnpm-lock.yaml", "utf8");
const next = packageJson.dependencies?.next;
const eslintNext = packageJson.devDependencies?.["eslint-config-next"];
const match = typeof next === "string" ? /^(\d+)\.(\d+)\.(\d+)$/.exec(next) : null;

if (!match) {
  throw new Error("Next.js must be pinned to an exact reviewed release");
}
const [, major, minor, patch] = match.map(Number);
if (major !== 16 || minor < 4 || (minor === 4 && patch < 5)) {
  throw new Error("Next.js is below the November 2026 patched version floor (16.4.5)");
}
if (eslintNext !== next) {
  throw new Error("eslint-config-next must match the pinned Next.js version");
}
for (const name of [
  "next",
  "eslint-config-next",
  "@next/env",
  "@next/eslint-plugin-next",
  "@next/swc-linux-arm64-gnu",
]) {
  const header = name.startsWith("@") ? `  "${name}@${next}":` : `  ${name}@${next}:`;
  if (!lock.includes(header)) {
    throw new Error(`Missing pinned lockfile artifact: ${name}@${next}`);
  }
}
if (lock.includes("16.4.3")) {
  throw new Error("The dependency lockfile still contains the affected Next.js 16.4.3 release");
}
console.log(`Next.js framework security floor passed: ${next}`);
