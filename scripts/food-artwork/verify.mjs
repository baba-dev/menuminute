#!/usr/bin/env node
// Validate import of the 36 separated dish illustrations; run only after artwork ZIP files are copied.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root,"docs/food-artwork/manifest.json"),"utf8"));
if (manifest.assets.length !== 36) throw new Error("Expected exactly 36 manifest entries");
const seen=new Set(); let errors=[];
for (const asset of manifest.assets) {
  if (seen.has(asset.path)) errors.push("Duplicate path: "+asset.path);
  seen.add(asset.path);
  const filename=join(root,"public",asset.path.slice(1));
  if (!existsSync(filename)) { errors.push("Missing: "+asset.path); continue; }
  const b=readFileSync(filename);
  if (b.length < 33 || b.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" || b.toString("ascii",12,16)!=="IHDR") {
    errors.push("Invalid PNG: "+asset.path); continue;
  }
  const w=b.readUInt32BE(16), h=b.readUInt32BE(20), color=b[25];
  if (w!==360 || h!==280 || color!==6) errors.push("Expected 360×280 RGBA PNG: "+asset.path+" (got "+w+"×"+h+", PNG color type "+color+")");
}
for (const category of ["indian","western","italian"]) {
  const dir=join(root,"public/assets/food/dishes",category);
  if (existsSync(dir)) for(const file of readdirSync(dir)) if(!seen.has("/assets/food/dishes/"+category+"/"+file)) errors.push("Unexpected file: "+category+"/"+file);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Verified 36 named 360×280 RGBA PNG artwork files.");
