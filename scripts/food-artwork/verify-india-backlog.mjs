#!/usr/bin/env node
/**
 * Verifies the editorial 200-dish illustration backlog in CSV/JSON forms.
 * No third-party packages and no app/runtime changes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const base = resolve("docs/food-artwork");
const csv = readFileSync(resolve(base, "india-200-dish-backlog.csv"), "utf8").trimEnd();
const data = JSON.parse(readFileSync(resolve(base, "india-200-dish-backlog.json"), "utf8"));
const fail = (message) => {
  throw new Error(`Dish backlog: ${message}`);
};

function parseCsvRow(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (line[i++] !== '"') fail("unquoted CSV field");
    let value = "";
    let closed = false;
    while (i < line.length) {
      if (line[i] === '"' && line[i + 1] === '"') {
        value += '"';
        i += 2;
      } else if (line[i] === '"') {
        i++;
        closed = true;
        break;
      } else {
        value += line[i++];
      }
    }
    if (!closed) fail("unclosed CSV quote");
    out.push(value);
    if (i < line.length && line[i++] !== ",") fail("invalid CSV delimiter");
  }
  return out;
}

const lines = csv.split(/\r?\n/);
const fields = lines.shift().split(",");
const csvDishes = lines.map((line, index) => {
  const vals = parseCsvRow(line);
  if (vals.length !== fields.length) fail(`CSV row ${index + 1} has ${vals.length} columns`);
  return Object.fromEntries(fields.map((field, i) => [field, vals[i]]));
});

if (data.schema_version !== "1.0.0") fail("schema version mismatch");
if (
  data.existing_assets_excluded.count !== 36 ||
  data.existing_assets_excluded.slugs.length !== 36
)
  fail("expected 36 existing-art exclusions");
if (data.dishes.length !== 200 || csvDishes.length !== 200)
  fail("exactly 200 candidates required");
if (JSON.stringify(csvDishes) !== JSON.stringify(data.dishes))
  fail("CSV/JSON values or row order disagree");

const slugs = new Set();
const ids = new Set();
const excluded = new Set(data.existing_assets_excluded.slugs);
const dietCounts = {};
const collectionCounts = {};
for (const [index, row] of data.dishes.entries()) {
  if (row.id !== `MM-IN-${String(index + 1).padStart(3, "0")}`)
    fail(`unexpected row ID at ${index + 1}`);
  if (
    !row.dish_name ||
    !row.slug ||
    !row.visual_anchor ||
    !row.regional_association ||
    !row.category
  )
    fail(`missing metadata: ${row.id}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)) fail(`invalid slug: ${row.slug}`);
  if (row.illustration_status !== "not_created")
    fail(`unexpected image status: ${row.slug}`);
  if (excluded.has(row.slug)) fail(`already illustrated: ${row.slug}`);
  if (slugs.has(row.slug) || ids.has(row.id)) fail(`duplicate asset key: ${row.slug}`);
  slugs.add(row.slug);
  ids.add(row.id);
  dietCounts[row.dietary_hint] = (dietCounts[row.dietary_hint] || 0) + 1;
  collectionCounts[row.collection] = (collectionCounts[row.collection] || 0) + 1;
}

const expectedCollections = {
  "north-punjab-kashmir": 20,
  "north-central-awadh-rajasthan": 20,
  "tamil-karnataka": 20,
  "kerala-andhra-telangana": 20,
  "west-maharashtra-gujarat-goa": 20,
  "east-bengal-odisha-bihar-jharkhand": 20,
  "northeast-himalayan": 20,
  "indo-chinese-starters": 25,
  "indo-chinese-mains-soups": 15,
  "sweets-desserts": 20,
};
if (JSON.stringify(collectionCounts) !== JSON.stringify(expectedCollections))
  fail("collection distribution changed");
if (
  JSON.stringify(dietCounts) !==
  JSON.stringify({ vegetarian: 136, non_vegetarian: 59, varies: 3, egg: 2 })
)
  fail("diet hint distribution changed");

console.log(
  "Verified: 200 unique candidates; CSV/JSON equivalent; 36 existing-art exclusions; category and dietary totals consistent.",
);
