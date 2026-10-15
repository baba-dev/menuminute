#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("docs/food-artwork");
const csvPath = resolve(root, "india-200-dish-backlog.csv");
const jsonPath = resolve(root, "india-200-dish-backlog.json");
const csv = readFileSync(csvPath, "utf8").trimEnd();
const data = JSON.parse(readFileSync(jsonPath, "utf8"));

function fail(message) {
  throw new Error(`Dish backlog: ${message}`);
}

function parseCsvRow(line) {
  const values = [];
  let index = 0;
  while (index < line.length) {
    if (line[index++] !== '"') fail("unquoted CSV field");
    let value = "";
    let closed = false;
    while (index < line.length) {
      if (line[index] === '"' && line[index + 1] === '"') {
        value += '"';
        index += 2;
      } else if (line[index] === '"') {
        index++;
        closed = true;
        break;
      } else {
        value += line[index++];
      }
    }
    if (!closed) fail("unclosed CSV quote");
    values.push(value);
    if (index < line.length && line[index++] !== ",") fail("invalid CSV delimiter");
  }
  return values;
}

const lines = csv.split(/\r?\n/);
const fields = lines.shift().split(",");
const csvDishes = lines.map((line, index) => {
  const values = parseCsvRow(line);
  if (values.length !== fields.length) fail(`bad column count in CSV row ${index + 1}`);
  return Object.fromEntries(fields.map((field, position) => [field, values[position]]));
});

if (data.schema_version !== "1.0.0") fail("schema version mismatch");
const excludedAssets = data.existing_assets_excluded;
if (excludedAssets.count !== 36 || excludedAssets.slugs.length !== 36) {
  fail("expected 36 existing-art exclusions");
}
if (data.dishes.length !== 200 || csvDishes.length !== 200) {
  fail("exactly 200 candidates required");
}
if (JSON.stringify(csvDishes) !== JSON.stringify(data.dishes)) {
  fail("CSV/JSON rows disagree");
}

const excluded = new Set(excludedAssets.slugs);
const slugs = new Set();
const ids = new Set();
const collectionCounts = {};
const dietCounts = {};

for (const [index, dish] of data.dishes.entries()) {
  const expectedId = `MM-IN-${String(index + 1).padStart(3, "0")}`;
  if (dish.id !== expectedId) fail(`unexpected row ID: ${dish.id}`);
  for (const field of ["dish_name", "slug", "visual_anchor", "regional_association", "category"]) {
    if (!dish[field]) fail(`missing ${field} for ${dish.id}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dish.slug)) fail(`invalid slug: ${dish.slug}`);
  if (dish.illustration_status !== "not_created") fail(`unexpected status: ${dish.id}`);
  if (excluded.has(dish.slug)) fail(`already illustrated: ${dish.slug}`);
  if (slugs.has(dish.slug) || ids.has(dish.id)) fail(`duplicate: ${dish.slug}`);
  slugs.add(dish.slug);
  ids.add(dish.id);
  collectionCounts[dish.collection] = (collectionCounts[dish.collection] || 0) + 1;
  dietCounts[dish.dietary_hint] = (dietCounts[dish.dietary_hint] || 0) + 1;
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
const expectedDiet = { vegetarian: 136, non_vegetarian: 59, varies: 3, egg: 2 };
if (JSON.stringify(collectionCounts) !== JSON.stringify(expectedCollections)) {
  fail("collection distribution changed");
}
if (JSON.stringify(dietCounts) !== JSON.stringify(expectedDiet)) {
  fail("diet hint distribution changed");
}
console.log("Validated: 200 candidates, 36 exclusions, equivalent CSV and JSON.");
