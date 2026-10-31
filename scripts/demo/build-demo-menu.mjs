#!/usr/bin/env node
// Deterministically builds the public-demo menu document (all catalogue dishes, every field filled)
// from src/data/dish-catalogue.json, the culinary profiles, the India-200 backlog and the artwork manifest.
// ALL derived culinary, dietary, allergen and nutrition values are SAMPLE DATA: verified=false everywhere,
// never a verifiedFreeFrom claim. Run: node scripts/demo/build-demo-menu.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const catalogue = read("src/data/dish-catalogue.json");
const profiles = read("src/data/culinary-profiles.json");
const backlog = read("docs/food-artwork/india-200-dish-backlog.json").dishes;
const manifest = read("docs/food-artwork/manifest.json");

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const hash = (s) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
};
const pick = (arr, key, off = 0) => arr[(hash(key) + off) % arr.length];
const has = (text, re) => re.test(text);

// ---------- artwork ----------
const assets = manifest.assets.map((a) => ({ ...a, id: `${a.category}__${a.slug}` }));
const byDataset = new Map(assets.filter((a) => a.datasetId).map((a) => [a.datasetId, a]));
const byLabel = new Map();
for (const a of assets) byLabel.set(norm(a.label), [...(byLabel.get(norm(a.label)) ?? []), a]);
// Explicit, conservative aliases: only where the illustration depicts the same dish.
const artAlias = {
  "Gobi Manchurian Dry": "Gobi Manchurian",
  "Vegetable Spring Rolls": "Veg Spring Rolls",
  "Steamed Vegetable Momos": "Momos",
  "Crispy Corn Salt and Pepper": "Salt & Pepper Corn",
  "Chilli Mushroom Dry": "Chilli Mushroom",
  "Vegetable Thukpa": "Thukpa",
  "Luchi with Aloo Dum": "Luchi Aloor Dom",
  "Sev Tameta Nu Shaak": "Sev Tameta",
  "Methi Thepla": "Thepla",
  "Vegetable Bai": "Bai",
  "Pesarattu Upma": "Pesarattu",
  "Appam with Vegetable Stew": "Appam with Stew",
  "Puttu Kadala Curry": "Puttu Kadala",
  "Malabar Parotta with Chicken Curry": "Kerala Parotta",
  "Papaya Khar": "Khar",
  "Chilli Chicken Dry": "Chilli Chicken",
  "Veg Manchurian Dry": "Veg Manchurian Dry",
};
function artworkFor(d) {
  const direct = byDataset.get(d.id);
  if (direct) return direct;
  const lab = byLabel.get(norm(d.name));
  if (lab?.length === 1) return lab[0];
  const alias = artAlias[d.name] && byLabel.get(norm(artAlias[d.name]));
  return alias?.length === 1 ? alias[0] : null;
}

// ---------- dish classification ----------
const num = (id) => (/^MM-IN-(\d+)$/.test(id) ? Number(id.slice(6)) : null);
const backlogById = new Map(backlog.map((b) => [b.id, b]));
const profileByName = new Map(profiles.map((p) => [norm(p.name), p]));
const profileFor = (d) =>
  profileByName.get(norm(d.name)) ??
  profiles.find((p) => (p.aliases ?? []).some((a) => norm(a) === norm(d.name)));

const proteinRules = [
  ["shellfish", /prawn|shrimp|chingri|royyala|balchao/],
  [
    "fish",
    /fish|maach|macha|machher|maas\b.*fish|meen|masor|karimeen|ilish|bombil|hilsa|gudok|dried fish|amritsari fish|chilli garlic fish/,
  ],
  ["beef", /beef/],
  ["pork", /pork|axone|dohneiiong|phagshapa|galho pork/],
  ["duck", /duck/],
  [
    "mutton",
    /mutton|lamb|laal maas|safed maas|nihari|haleem|rogan josh|kosha mangsho|galouti|kakori|korma$|champaran|tambda rassa/,
  ],
  [
    "chicken",
    /chicken|kodi|kori rotti|saoji|chettinad chicken|65$|lollipop|drums of heaven|dragon/,
  ],
  ["egg", /\begg\b|bebinca|pancake|donut/],
];
const nonVegHint = (d) => backlogById.get(d.id)?.dietary_hint;
function protein(d) {
  const t = norm(d.name + " " + d.publicDescription);
  if (
    /paneer|mushroom|veg|aloo|gobi|baby corn|corn|soya|lotus/.test(norm(d.name)) &&
    !/chicken|fish|prawn|mutton|pork|beef/.test(norm(d.name))
  ) {
    if (nonVegHint(d) !== "non_vegetarian") return null;
  }
  if (nonVegHint(d) === "vegetarian") return null;
  for (const [p, re] of proteinRules) {
    if (p === "egg") continue;
    if (re.test(norm(d.name))) return p;
  }
  for (const [p, re] of proteinRules) {
    if (p === "egg") continue;
    if (re.test(t) && nonVegHint(d) !== "vegetarian") return p;
  }
  if (/sausage/.test(t)) return "pork";
  if (/steak|protein/.test(norm(d.name)) && d.id === "MM-CORE-steak") return "beef";
  if (/biryani$|^biryani$/.test(norm(d.name))) return null;
  return null;
}
const isEgg = (d) =>
  nonVegHint(d) === "egg" ||
  /\begg\b|bebinca|pancake|donut|tiramisu|caesar|mayo/.test(
    norm(d.name + " " + d.publicDescription)
  );

const indoChinese = (d) => {
  const n = num(d.id);
  return n !== null && n >= 141 && n <= 180;
};
const southIndian =
  /dosa|idli|vada\b|vada |pongal|puttu|appam|paniyaram|bonda|pesarattu|uttapam|mangalore buns|parotta|adai|chow chow|mudde|akki|kori rotti|curd rice|lemon rice|puliyodarai|bisi bele|maddur/;
const riceDish =
  /biryani|pulao|tehri|fried rice|schezwan rice|curd rice|lemon rice|puliyodarai|bisi bele|pakhala|khichdi|jadoh|galho|chawal|triple schezwan/;

export const CATEGORIES = [
  [
    "cat-starters",
    "Starters & Tandoor",
    "Kebabs, tikkas and crisp bites straight from the flame and the fryer.",
  ],
  [
    "cat-indo-chinese",
    "Indo-Chinese",
    "Wok-tossed street-style favourites with bold garlic, chilli and soy.",
  ],
  [
    "cat-soups-salads",
    "Soups & Salads",
    "Warming bowls and fresh plates to begin or lighten a meal.",
  ],
  [
    "cat-veg-curries",
    "Vegetarian Curries",
    "Slow-simmered gravies, dals and sabzis from across India.",
  ],
  ["cat-nonveg-curries", "Non-Veg Curries", "Chicken, mutton, seafood and regional meat classics."],
  ["cat-rice", "Rice & Biryani", "Fragrant dum biryanis, pulaos and comforting rice bowls."],
  ["cat-breads", "Breads & Rotis", "Tandoor-baked and griddled breads to scoop up every curry."],
  [
    "cat-south-indian",
    "South Indian Tiffin",
    "Crisp dosas, fluffy idlis, vadas and coastal specialities.",
  ],
  ["cat-chaat", "Chaat, Snacks & Breakfast", "Street-food classics and all-day snacking."],
  [
    "cat-regional",
    "Regional Specialties",
    "Rare home-style dishes from the North-East, Odisha, Jharkhand and beyond.",
  ],
  ["cat-italian", "Italian Kitchen", "Pasta, pizza and antipasti made the Italian way."],
  ["cat-cafe-grill", "Café & Grill", "Burgers, grills and comfort plates."],
  [
    "cat-sides",
    "Sides & Accompaniments",
    "Chutneys, salans and small plates that complete the table.",
  ],
  [
    "cat-desserts",
    "Mithai, Desserts & Shakes",
    "Syrup-soaked sweets, frozen treats and chilled shakes.",
  ],
];
function categoryOf(d) {
  const h = d.categoryHint;
  const n = norm(d.name);
  const k = num(d.id);
  const p = protein(d);
  if (h === "Italian") return /tiramisu|gelato/.test(n) ? "cat-desserts" : "cat-italian";
  if (h === "Western") {
    if (/caesar/.test(n)) return "cat-soups-salads";
    if (/milkshake|donut/.test(n)) return "cat-desserts";
    return "cat-cafe-grill";
  }
  if (h === "Desserts") return "cat-desserts";
  if (h === "Soups" || /soup/.test(n)) return "cat-soups-salads";
  if (h === "Breads" && !southIndian.test(n)) return "cat-breads";
  if (/^naan$/.test(n)) return "cat-breads";
  if (/gulab jamun/.test(n)) return "cat-desserts";
  if (indoChinese(d)) {
    if (riceDish.test(n)) return "cat-rice";
    return "cat-indo-chinese";
  }
  if (southIndian.test(n) && !/chettinad|curry rice|chicken/.test(n)) return "cat-south-indian";
  if (riceDish.test(n)) return "cat-rice";
  if (
    k !== null &&
    ((k >= 111 && k <= 140) || (k >= 118 && k <= 120)) &&
    h !== "Sides" &&
    h !== "Soups"
  )
    return "cat-regional";
  if (h === "Other") return "cat-regional";
  if (h === "Sides") return "cat-sides";
  if (h === "Street Food" || h === "Snacks" || h === "Breakfast") return "cat-chaat";
  if (/samosa|vada pav/.test(n)) return "cat-chaat";
  if (h === "Starters" || /paneer tikka/.test(n)) return "cat-starters";
  if (/butter chicken/.test(n) || p) return "cat-nonveg-curries";
  return "cat-veg-curries";
}

// ---------- ingredient / allergen engine ----------
const L = (...x) => x;
const proteinIngredients = {
  chicken: L("Chicken"),
  mutton: L("Mutton"),
  beef: L("Beef"),
  pork: L("Pork"),
  duck: L("Duck"),
  fish: L("Fish fillet"),
  shellfish: L("Prawns"),
};
const styleRules = [
  [
    /tandoor|tikka|kebab|kakori|galouti|malai/,
    L(
      "Yogurt marinade",
      "Kashmiri chilli",
      "Ginger-garlic paste",
      "Garam masala",
      "Lemon juice",
      "Mustard oil"
    ),
  ],
  [
    /manchurian|schezwan|chilli|hot garlic|hakka|chop suey|dragon|salt and pepper|honey chilli|kung pao|lollipop|drums|triple|thukpa|manchow|hot and sour|black pepper sauce/,
    L(
      "Soy sauce",
      "Garlic",
      "Spring onion",
      "Ginger",
      "Green chilli",
      "Capsicum",
      "Rice vinegar",
      "Cornflour",
      "Sesame oil"
    ),
  ],
  [
    /dosa|idli|uttapam|vada\b|medu|paniyaram|pesarattu|adai|sambar|bonda/,
    L("Curry leaves", "Mustard seeds", "Urad dal", "Green chilli", "Coconut chutney", "Asafoetida"),
  ],
  [
    /chettinad|kerala|malabar|appam|avial|moilee|meen|karimeen|sukka|kori|kuzhi|puttu|erachi|pazham|sadya/,
    L(
      "Coconut",
      "Curry leaves",
      "Black pepper",
      "Mustard seeds",
      "Dried red chilli",
      "Coconut oil"
    ),
  ],
  [
    /bengali|posto|shorshe|ilish|macher|kosha|doi maach|luchi|shukto|mochar|basanti|chingri|santula/,
    L("Mustard oil", "Panch phoron", "Green chilli", "Turmeric", "Ginger"),
  ],
  [
    /hyderabadi|bagara|mirchi ka salan|haleem|double ka|qubani/,
    L("Tamarind", "Peanuts", "Sesame seeds", "Coconut", "Curry leaves", "Cumin"),
  ],
  [
    /kashmiri|yakhni|rogan|nadru|haak|dum aloo/,
    L(
      "Fennel powder",
      "Dried ginger powder",
      "Kashmiri chilli",
      "Yogurt",
      "Cardamom",
      "Mustard oil"
    ),
  ],
  [
    /goan|cafreal|balchao|bebinca|xacuti/,
    L("Coconut", "Palm vinegar", "Kashmiri chilli", "Garlic", "Cloves", "Cinnamon"),
  ],
  [
    /gujarati|dhokla|khandvi|thepla|undhiyu|handvo|patra|sev tameta|dal dhokli|fafda/,
    L("Gram flour", "Sesame seeds", "Mustard seeds", "Green chilli", "Jaggery", "Coriander leaves"),
  ],
  [
    /rajasthani|laal maas|safed maas|gatte|ker sangri|dal baati|mirchi vada|pyaaz kachori|ghevar|baati/,
    L("Ghee", "Red chilli", "Yogurt", "Gram flour", "Cumin", "Asafoetida"),
  ],
  [
    /maharashtra|kolhapuri|saoji|misal|pav bhaji|vada pav|thalipeeth|pithla|bharli|kothimbir|modak|puran poli|sol kadhi/,
    L("Goda masala", "Onion", "Tomato", "Dried coconut", "Jaggery", "Coriander leaves"),
  ],
  [
    /punjabi|amritsari|chole|dal makhani|kulcha|makki|sarson|kadhi pakora|rajma/,
    L("Butter", "Onion", "Tomato", "Ginger-garlic paste", "Garam masala", "Kasuri methi"),
  ],
  [
    /pizza|pasta|spaghetti|penne|lasagna|ravioli|risotto|gnocchi|bruschetta|focaccia|caprese|alfredo/,
    L("Olive oil", "Garlic", "Basil", "Black pepper", "Sea salt"),
  ],
  [
    /burger|hot dog|sandwich|fried chicken|fries|mac and cheese|steak|pancake|grilled fish|donut|milkshake|caesar/,
    L("Butter", "Black pepper", "Sea salt", "Garlic"),
  ],
];
const typeBase = {
  "cat-starters": L("Onion", "Ginger-garlic paste", "Garam masala", "Lemon juice", "Chaat masala"),
  "cat-indo-chinese": L("Onion", "Garlic", "Soy sauce", "Spring onion", "Black pepper"),
  "cat-soups-salads": L("Vegetable stock", "Black pepper", "Spring onion", "Sea salt"),
  "cat-veg-curries": L(
    "Onion",
    "Tomato",
    "Ginger-garlic paste",
    "Turmeric",
    "Coriander powder",
    "Cumin"
  ),
  "cat-nonveg-curries": L(
    "Onion",
    "Tomato",
    "Ginger-garlic paste",
    "Turmeric",
    "Coriander powder",
    "Garam masala"
  ),
  "cat-rice": L("Basmati rice", "Whole spices", "Onion", "Salt"),
  "cat-breads": L("Whole wheat flour", "Salt", "Water", "Ghee"),
  "cat-south-indian": L("Rice", "Urad dal", "Salt", "Oil"),
  "cat-chaat": L("Potato", "Green chilli", "Coriander leaves", "Chaat masala", "Lemon juice"),
  "cat-regional": L("Onion", "Ginger", "Green chilli", "Turmeric", "Salt"),
  "cat-italian": L("Parmesan", "Olive oil", "Garlic", "Basil", "Sea salt"),
  "cat-cafe-grill": L("Butter", "Black pepper", "Sea salt"),
  "cat-sides": L("Green chilli", "Mustard seeds", "Salt", "Oil"),
  "cat-desserts": L("Sugar", "Milk", "Cardamom", "Ghee"),
};
const keywordIngredients = [
  [/paneer/, "Paneer"],
  [/aloo|potato|dum aloo/, "Potato"],
  [/gobi|cauliflower/, "Cauliflower"],
  [/mushroom/, "Mushroom"],
  [/baingan|eggplant|vangi|vankaya|bharta/, "Eggplant"],
  [/bhindi|okra/, "Okra"],
  [/corn|bhutte/, "Sweet corn"],
  [/baby corn/, "Baby corn"],
  [/palak|spinach/, "Spinach"],
  [/dal|lentil|sambar|moong|chana/, "Lentils"],
  [/chole|chickpea|kadala/, "Chickpeas"],
  [/rajma|kidney/, "Kidney beans"],
  [/matar|pea\b/, "Green peas"],
  [/cashew|kaju|shahi|korma|malai kofta/, "Cashew paste"],
  [/cream|makhani|butter chicken|shahi|malai/, "Fresh cream"],
  [/butter|makhani/, "Butter"],
  [/kofta/, "Potato-paneer dumplings"],
  [/soya|chaap/, "Soya chaap"],
  [/lotus/, "Lotus stem"],
  [/noodle|hakka|chop suey|thukpa|pan-fried/, "Wheat noodles"],
  [/fried rice|schezwan rice|triple/, "Cooked rice"],
  [/momo|spring roll|manchow/, "Wheat-flour wrapper"],
  [/spring roll/, "Cabbage"],
  [/tomato|tameta|tamatar/, "Tomato"],
  [/coconut|kheer|payasam|modak|bebinca|patishapta/, "Coconut"],
  [/jaggery|gur\b|puran|modak|thekua/, "Jaggery"],
  [/curd|dahi|doi|yogurt|kadhi|shrikhand|lassi/, "Yogurt"],
  [/mustard/, "Mustard paste"],
  [/poppy|posto/, "Poppy seeds"],
  [/gongura|sorrel/, "Gongura leaves"],
  [/tamarind|puliyodarai|ulava/, "Tamarind"],
  [/peanut|puliyodarai|poha|sabudana/, "Peanuts"],
  [/poha/, "Flattened rice"],
  [/sabudana/, "Tapioca pearls"],
  [/semolina|upma/, "Semolina"],
  [/ragi|mudde/, "Finger millet flour"],
  [
    /jalebi|balushahi|malpua|ghevar|halwa|ladoo|kaju katli|mysore pak|rasgulla|rasmalai|gulab|kulfi|payasam|kheer|shrikhand|poda|bebinca|double|chak hao|modak|puran poli|patishapta|tiramisu|gelato|donut/,
    "Sugar",
  ],
  [/halwa|ladoo|mysore pak|balushahi|malpua|ghevar|puran|motichoor|besan/, "Ghee"],
  [/rasgulla|rasmalai|poda|rabri|kulfi|gulab|khoa|malpua|halwa|kheer|payasam/, "Milk solids"],
  [/gajar/, "Carrot"],
  [
    /besan|ladoo besan|mysore pak|kadhi|pakora|dhokla|khandvi|handvo|pithla|gatte|kothimbir/,
    "Gram flour",
  ],
  [/saffron|sheermal|kesari/, "Saffron"],
  [/black rice|chak hao/, "Black rice"],
  [/bamboo/, "Bamboo shoot"],
  [/fermented soy|axone|tungrymbai|kinema/, "Fermented soybean"],
  [
    /pizza|margherita|caprese|lasagna|ravioli|mac and cheese|alfredo|risotto|gnocchi|bruschetta/,
    "Mozzarella",
  ],
  [
    /pizza|spaghetti|penne|lasagna|ravioli|gnocchi|mac and cheese|focaccia|burger|hot dog|sandwich|bruschetta|pav\b|bun|bread|donut|pancake/,
    "Wheat flour",
  ],
  [/spaghetti|penne|mac and cheese|lasagna|ravioli/, "Durum wheat pasta"],
  [/tiramisu/, "Mascarpone"],
  [/tiramisu/, "Coffee"],
  [/tiramisu|pancake|donut|caesar|bebinca|\begg\b/, "Eggs"],
  [/caesar/, "Romaine lettuce"],
  [/milkshake|gelato|kulfi/, "Milk"],
  [/french fries|fries/, "Potatoes"],
  [/avial|stew|sadya|undhiyu|shukto|vegetable|veg\b|mixed/, "Mixed vegetables"],
  [/jackfruit|kathal/, "Raw jackfruit"],
  [/papaya/, "Raw papaya"],
  [/pumpkin/, "Pumpkin"],
];
const ingredientFor = (d, cat, prot, egg, regionHint) => {
  const t = norm(d.name + " " + d.publicDescription);
  const set = [];
  const add = (x) => x && !set.includes(x) && set.push(x);
  if (prot) proteinIngredients[prot].forEach(add);
  if (egg) add("Eggs");
  for (const [re, i] of keywordIngredients) if (re.test(t)) add(i);
  for (const [re, items] of styleRules)
    if (re.test(norm(d.name) + " " + (regionHint ?? ""))) items.forEach(add);
  (typeBase[cat] ?? []).forEach(add);
  if (/biryani|pulao|tehri|khichdi/.test(t)) ["Ghee"].forEach(add);
  if (/biryani|pulao/.test(t)) ["Saffron", "Mint leaves", "Fried onion"].forEach(add);
  if (/spicy|chilli|hot|fiery|pepper/.test(t)) add("Green chilli");
  return set.slice(0, 18).map((x) => x.slice(0, 60));
};
// vegan/dairy/gluten/etc. derived ONLY from the generated ingredient list.
const dairyWords =
  /paneer|butter|cream|ghee|yogurt|milk|mascarpone|mozzarella|parmesan|cheese|khoa|malai/i;
const glutenWords =
  /wheat|noodles|pasta|wrapper|semolina|bread|bun\b|soy sauce|flour(?! .*(rice|gram))|durum|pav/i;
const allergensOf = (ing, name) => {
  const j = ing.join("|");
  const a = new Set();
  if (dairyWords.test(j)) a.add("dairy");
  if (
    (glutenWords.test(j) && !/^(Rice|Gram flour|Finger millet)/.test(j)) ||
    /whole wheat|wheat flour|durum/i.test(j)
  )
    a.add("gluten");
  if (/soy sauce/i.test(j)) {
    a.add("soy");
    a.add("gluten");
  }
  if (/soya chaap|fermented soybean/i.test(j)) a.add("soy");
  if (/cashew|almond|pistachio/i.test(j)) a.add("nuts");
  if (/peanut/i.test(j)) a.add("peanuts");
  if (/\beggs?\b/i.test(j)) a.add("eggs");
  if (/fish|hilsa/i.test(j)) a.add("fish");
  if (/prawn/i.test(j)) a.add("shellfish");
  if (/sesame/i.test(j)) a.add("sesame");
  if (/mustard/i.test(j)) a.add("mustard");
  if (/palm vinegar|rice vinegar/i.test(j) && /sulfit/.test(name)) a.add("sulfites");
  return [...a].sort();
};

// ---------- flavour, spice, temperature, nutrition ----------
function spiceOf(d, cat, prot) {
  const t = norm(d.name + " " + d.publicDescription);
  let s =
    {
      "cat-desserts": 0,
      "cat-italian": 0,
      "cat-cafe-grill": 0,
      "cat-breads": 0,
      "cat-soups-salads": 1,
      "cat-chaat": 2,
      "cat-starters": 2,
      "cat-indo-chinese": 2,
      "cat-rice": 1,
      "cat-sides": 1,
      "cat-south-indian": 1,
      "cat-regional": 2,
      "cat-veg-curries": 2,
      "cat-nonveg-curries": 2,
    }[cat] ?? 1;
  if (
    /fiery|laal maas|kolhapuri|tambda|saoji|andhra|gongura|chettinad|schezwan|hot garlic|dragon|65\b|spicy|dried chilies|chilli garlic|mirchi|pepper-forward/.test(
      t
    )
  )
    s += 1;
  if (/kolhapuri|tambda|laal maas|saoji|andhra|gongura|fiery/.test(t)) s += 1;
  if (
    /malai|korma|shahi|makhani|butter|mild|gently|creamy|delicate|light|sweet|milk|stew|yakhni|moilee|curd/.test(
      t
    )
  )
    s -= 1;
  if (cat === "cat-desserts" || cat === "cat-italian" || cat === "cat-cafe-grill")
    s = /pepper|chilli/.test(t) ? 1 : 0;
  return Math.max(0, Math.min(4, s));
}
const flavorMap = [
  [/smok|tandoor|char|roast|kebab|tikka/, "Smoky"],
  [/cream|makhani|malai|shahi|rich|butter/, "Rich & Creamy"],
  [/tang|sour|tamarind|lemon|vinegar|gongura|kokum/, "Tangy"],
  [/fiery|spicy|chilli|chili|pepper|hot/, "Fiery"],
  [/coconut/, "Coconut-kissed"],
  [/crisp|crunch|fried|golden|crispy/, "Crisp"],
  [/sweet|sugar|syrup|jaggery|honey|kheer|halwa|ladoo/, "Sweet"],
  [/nutty|cashew|almond|peanut|sesame|poppy/, "Nutty"],
  [/garlic/, "Garlicky"],
  [/herb|mint|coriander|basil|green/, "Herbal"],
  [/mustard/, "Pungent"],
  [/yogurt|curd|dahi/, "Cooling"],
  [/cheese|mozzarella|parmesan/, "Cheesy"],
  [/fermented|umami|soy|mushroom/, "Umami"],
  [/fragrant|aromatic|saffron|cardamom|whole spices/, "Aromatic"],
  [/comfort|soft|stew|porridge|khichdi|pongal/, "Comforting"],
  [/earthy|millet|lentil|dal/, "Earthy"],
];
function flavors(d, cat, spice) {
  const t = norm(d.name + " " + d.publicDescription).replace(/hot dog/g, "frank");
  const out = [];
  for (const [re, f] of flavorMap) if (re.test(t) && !out.includes(f)) out.push(f);
  const fb = {
    "cat-desserts": ["Sweet", "Silky", "Indulgent"],
    "cat-breads": ["Soft", "Toasty", "Buttery"],
    "cat-italian": ["Savoury", "Herbal", "Comforting"],
    "cat-cafe-grill": ["Savoury", "Juicy", "Comforting"],
    "cat-soups-salads": ["Light", "Fresh", "Warming"],
    "cat-sides": ["Zesty", "Fresh", "Bold"],
    "cat-chaat": ["Tangy", "Crunchy", "Zesty"],
    "cat-regional": ["Earthy", "Authentic", "Homestyle"],
  }[cat] ?? ["Aromatic", "Balanced", "Homestyle"];
  for (const f of fb) if (!out.includes(f)) out.push(f);
  if (spice >= 3 && !out.includes("Fiery")) out.unshift("Fiery");
  return out.slice(0, 4);
}
const chilled =
  /kulfi|gelato|milkshake|rasgulla|rasmalai|shrikhand|tiramisu|caesar|caprese|curd rice|singju|sol kadhi/;
const temp = (d) =>
  chilled.test(norm(d.name))
    ? "chilled"
    : /donut|laddoo|ladoo|kaju katli|mysore pak|motichoor|besan|balushahi|thekua|sev tameta|bruschetta|focaccia|gundruk|papaya khar|ker sangri|methi thepla|thepla/.test(
          norm(d.name)
        )
      ? "ambient"
      : "hot";

const base = {
  "cat-starters": { cal: 340, p: 18, f: 20, price: 289, size: "6–8 pieces (approx. 220g)" },
  "cat-indo-chinese": { cal: 420, p: 15, f: 22, price: 269, size: "1 plate (approx. 280g)" },
  "cat-soups-salads": { cal: 160, p: 7, f: 6, price: 149, size: "1 bowl (approx. 300ml)" },
  "cat-veg-curries": { cal: 380, p: 11, f: 22, price: 259, size: "1 bowl (approx. 300g)" },
  "cat-nonveg-curries": { cal: 520, p: 32, f: 32, price: 349, size: "1 bowl (approx. 320g)" },
  "cat-rice": { cal: 560, p: 16, f: 18, price: 279, size: "1 plate (approx. 380g)" },
  "cat-breads": { cal: 230, p: 7, f: 7, price: 79, size: "1 piece (approx. 90g)" },
  "cat-south-indian": { cal: 330, p: 9, f: 11, price: 169, size: "1 serving (approx. 250g)" },
  "cat-chaat": { cal: 310, p: 7, f: 13, price: 129, size: "1 plate (approx. 200g)" },
  "cat-regional": { cal: 440, p: 22, f: 20, price: 339, size: "1 serving (approx. 350g)" },
  "cat-italian": { cal: 620, p: 22, f: 26, price: 399, size: "1 plate (approx. 350g)" },
  "cat-cafe-grill": { cal: 650, p: 26, f: 30, price: 349, size: "1 serving (approx. 320g)" },
  "cat-sides": { cal: 120, p: 3, f: 7, price: 99, size: "1 small portion (approx. 100g)" },
  "cat-desserts": { cal: 300, p: 5, f: 13, price: 149, size: "1 serving (approx. 120g)" },
};
const protMult = {
  chicken: 1.15,
  mutton: 1.45,
  beef: 1.25,
  pork: 1.3,
  duck: 1.5,
  fish: 1.3,
  shellfish: 1.5,
};
const protProt = { chicken: 12, mutton: 12, beef: 10, pork: 8, duck: 8, fish: 12, shellfish: 12 };

function priceOf(d, cat, prot) {
  let p = base[cat].price * (prot ? protMult[prot] : 1);
  const t = norm(d.name);
  if (/paneer|kaju|malai kofta|shahi|cashew/.test(t) && !prot) p *= 1.12;
  if (/mushroom|lotus|soya/.test(t)) p *= 1.05;
  p *= 1 + ((hash(d.id) % 15) - 7) / 100; // +/-7% deterministic spread
  return Math.round(p / 10) * 10 - 1; // e.g. 299
}
function nutritionOf(d, cat, prot, spice) {
  const b = base[cat];
  const j = (hash(d.id + "n") % 21) - 10; // +/-10%
  const cal = Math.round((b.cal * (prot ? 1.05 : 1) * (1 + j / 100)) / 5) * 5;
  const protein = Math.max(
    1,
    Math.round(b.p + (prot ? protProt[prot] : 0) + ((hash(d.id + "p") % 5) - 2))
  );
  const fat = Math.max(
    1,
    Math.round(b.f * (1 + j / 150) + (prot === "mutton" || prot === "pork" ? 4 : 0))
  );
  const carbs = Math.max(2, Math.round((cal - protein * 4 - fat * 9) / 4));
  const fiber = Math.max(0, Math.round(carbs * (cat === "cat-desserts" || prot ? 0.04 : 0.1)));
  return {
    calories: cal,
    proteinGrams: protein,
    carbsGrams: carbs,
    fatGrams: fat,
    fiberGrams: fiber,
    servingSize: b.size,
    verified: false,
  };
}
function chefNote(d, cat, prot, spice, region) {
  const where =
    region && region !== "Pan-India" ? `${region.split(" / ")[0]} classic` : "house favourite";
  const lines = {
    "cat-starters": [
      `A ${where}, marinated well and finished over high heat. Squeeze lemon over it before the first bite.`,
      `Our ${where}: crisp edges, juicy centre. Best shared and eaten hot with mint chutney.`,
    ],
    "cat-indo-chinese": [
      `Wok-tossed on a roaring flame so every piece stays crisp. Our ${where} for sharing.`,
      `Tossed fast and hot for that smoky wok aroma. Pair with fried rice or noodles.`,
    ],
    "cat-soups-salads": [
      `A light, well-balanced starter to wake up the appetite.`,
      `Made fresh through the day; ask for extra pepper at the table.`,
    ],
    "cat-veg-curries": [
      `Slow-simmered until the masala turns glossy. A ${where} that loves a warm bread.`,
      `Cooked in small batches so the spices stay bright. Best with a soft roti or steamed rice.`,
    ],
    "cat-nonveg-curries": [
      `Cooked low and slow until tender. A ${where} built on a deep, patient masala.`,
      `Rich, balanced and made fresh daily. Mop up every drop with bread or rice.`,
    ],
    "cat-rice": [
      `Fragrant, fluffy grains with whole spices; a complete bowl with raita or salan.`,
      `Layered and sealed so the aroma stays locked in until it reaches your table.`,
    ],
    "cat-breads": [
      `Rolled to order and cooked hot. Soft inside, lightly blistered outside.`,
      `Brushed with ghee straight from the griddle for scooping up every curry.`,
    ],
    "cat-south-indian": [
      `A ${where} served the traditional way, with chutneys and a piping-hot accompaniment.`,
      `Fermented batter, hot griddle, a little patience. That is the whole secret.`,
    ],
    "cat-chaat": [
      `A ${where}: crunchy, tangy and a little messy, as street food should be.`,
      `Assembled to order so every bite keeps its crunch.`,
    ],
    "cat-regional": [
      `A ${where} from the lesser-told corners of Indian cooking, made the way families make it at home.`,
      `Authentic, unfussy and deeply flavoured: a plate with a story.`,
    ],
    "cat-italian": [
      `Made the Italian way: simple ingredients, honest flavour, a generous finish.`,
      `Baked or tossed to order; best enjoyed the moment it lands on the table.`,
    ],
    "cat-cafe-grill": [
      `A comfort plate done properly: seasoned, seared and served hot.`,
      `Generous portion, bold seasoning and a perfectly toasted finish.`,
    ],
    "cat-sides": [
      `A small plate with big flavour. It lifts any meal.`,
      `Fresh, zesty and made in small batches to complete the table.`,
    ],
    "cat-desserts": [
      `A sweet finish worth saving room for; best shared.`,
      `Made in small batches with real ghee and milk; ask for it warm or chilled as suits.`,
    ],
  };
  return pick(lines[cat], d.id).slice(0, 300);
}
function descriptionOf(d, region, anchor, cat, prot) {
  let s = d.publicDescription.trim();
  if (!/[.!?]$/.test(s)) s += ".";
  if (anchor && !/^[A-Z]/.test(anchor)) s += ` Served as ${anchor}.`;
  else if (anchor) s += ` ${anchor}.`;
  if (
    region &&
    !/Pan-India|National|Multiple|Global/i.test(region) &&
    !s.includes(region.split(" / ")[0])
  )
    s += ` Regional roots: ${region}.`;
  return s.slice(0, 600);
}

// ---------- variants & add-ons ----------
const money = (rs) => rs * 100;
function variantsOf(d, cat, price) {
  const t = norm(d.name);
  const v = (n, rs, i) => ({
    id: `${d.id}-v${i}`,
    name: n,
    priceMinor: money(rs),
    isAvailable: true,
  });
  if (
    [
      "cat-veg-curries",
      "cat-nonveg-curries",
      "cat-starters",
      "cat-indo-chinese",
      "cat-rice",
      "cat-regional",
      "cat-chaat",
    ].includes(cat) &&
    !/^(naan)$/.test(t)
  )
    return [
      v("Half", Math.max(49, Math.round((price * 0.62) / 10) * 10 - 1), 1),
      v("Full", price, 2),
    ];
  if (/pizza/.test(t)) return [v('Regular 8"', price, 1), v('Large 12"', price + 140, 2)];
  if (cat === "cat-italian" && /pasta|spaghetti|penne|lasagna|ravioli|gnocchi|risotto/.test(t))
    return [v("Regular", price, 1), v("Large", price + 90, 2)];
  if (/milkshake/.test(t)) return [v("Regular 300ml", price, 1), v("Large 450ml", price + 50, 2)];
  if (cat === "cat-cafe-grill" && /burger|sandwich|hot dog|fried chicken/.test(t))
    return [v("Single", price, 1), v("Double", price + 110, 2)];
  if (cat === "cat-soups-salads") return [v("Regular", price, 1), v("Large", price + 50, 2)];
  if (cat === "cat-south-indian" || cat === "cat-sides") return [];
  return [];
}
function addOnsOf(d, cat, spice, prot, veg) {
  const g = (i, name, min, max, opts) => ({
    id: `${d.id}-g${i}`,
    name,
    min,
    max,
    options: opts.map(([n, rs], k) => ({
      id: `${d.id}-g${i}-o${k + 1}`,
      name: n,
      priceMinor: money(rs),
      isAvailable: true,
    })),
  });
  const groups = [];
  let i = 1;
  const spiceChoosable =
    spice >= 1 && !["cat-desserts", "cat-breads", "cat-soups-salads", "cat-sides"].includes(cat);
  if (spiceChoosable)
    groups.push(
      g(i++, "Spice level", 1, 1, [
        ["Mild", 0],
        ["Medium", 0],
        ["Hot", 0],
      ])
    );
  if (cat === "cat-veg-curries" || cat === "cat-nonveg-curries" || cat === "cat-regional")
    groups.push(
      g(i++, "Pair with", 0, 2, [
        ["Butter Naan", 55],
        ["Tandoori Roti", 30],
        ["Steamed Rice", 80],
        ["Jeera Rice", 110],
      ])
    );
  if (cat === "cat-starters" || cat === "cat-indo-chinese" || cat === "cat-chaat")
    groups.push(
      g(i++, "Dips & extras", 0, 2, [
        ["Mint chutney", 0],
        ["Schezwan mayo", 25],
        ["Extra onion rings", 30],
      ])
    );
  if (cat === "cat-rice")
    groups.push(
      g(i++, "Accompaniment", 0, 2, [
        ["Boondi raita", 40],
        ["Mirchi ka salan", 50],
        ["Papad", 20],
      ])
    );
  if (cat === "cat-italian")
    groups.push(
      g(i++, "Extras", 0, 3, [
        ["Extra cheese", 60],
        ["Garlic bread (2 pcs)", 90],
        ["Chilli flakes & oregano", 0],
      ])
    );
  if (cat === "cat-cafe-grill")
    groups.push(
      g(i++, "Make it a combo", 0, 2, [
        ["Fries", 90],
        ["Coleslaw", 50],
        ["Soft drink", 60],
      ])
    );
  if (cat === "cat-south-indian")
    groups.push(
      g(i++, "Extras", 0, 2, [
        ["Extra chutney", 20],
        ["Extra sambar", 25],
        ["Ghee roast finish", 30],
      ])
    );
  if (cat === "cat-desserts")
    groups.push(
      g(i++, "Top it off", 0, 2, [
        ["Vanilla ice cream scoop", 60],
        ["Rabri spoon", 45],
        ["Dry-fruit crunch", 35],
      ])
    );
  if (cat === "cat-breads")
    groups.push(
      g(i++, "Finish", 0, 1, [
        ["Extra butter", 10],
        ["Garlic & coriander", 15],
      ])
    );
  return groups;
}
function pairingsOf(d, cat, ids) {
  const pools = {
    "cat-veg-curries": ["MM-CORE-naan", "MM-IN-011", "MM-IN-093", "MM-IN-024", "MM-IN-049"],
    "cat-nonveg-curries": ["MM-CORE-naan", "MM-IN-024", "MM-IN-011", "MM-IN-049", "MM-IN-050"],
    "cat-regional": ["MM-IN-049", "MM-IN-050", "MM-CORE-naan", "MM-IN-117"],
    "cat-rice": ["MM-IN-080", "MM-IN-070", "MM-IN-176", "MM-IN-175"],
    "cat-starters": ["MM-IN-142", "MM-IN-141", "MM-IN-174", "MM-CORE-naan"],
    "cat-indo-chinese": ["MM-IN-174", "MM-IN-176", "MM-IN-169", "MM-IN-166", "MM-IN-170"],
    "cat-breads": ["MM-IN-001", "MM-CORE-dal-tadka", "MM-IN-002", "MM-IN-003"],
    "cat-south-indian": ["MM-IN-041", "MM-IN-091", "MM-IN-042", "MM-IN-047"],
    "cat-chaat": ["MM-CORE-vada-pav", "MM-CORE-samosa", "MM-IN-081", "MM-IN-082"],
    "cat-italian": [
      "MM-CORE-focaccia",
      "MM-CORE-bruschetta",
      "MM-CORE-tiramisu",
      "MM-CORE-caprese-salad",
    ],
    "cat-cafe-grill": [
      "MM-CORE-french-fries",
      "MM-CORE-milkshake",
      "MM-CORE-caesar-salad",
      "MM-CORE-donut",
    ],
    "cat-soups-salads": ["MM-IN-142", "MM-CORE-focaccia", "MM-IN-141", "MM-CORE-bruschetta"],
    "cat-sides": ["MM-CORE-naan", "MM-IN-001", "MM-IN-002", "MM-CORE-biryani"],
    "cat-desserts": [
      "MM-IN-184",
      "MM-CORE-gulab-jamun",
      "MM-IN-196",
      "MM-IN-182",
      "MM-CORE-milkshake",
    ],
  };
  const pool = (pools[cat] ?? []).filter((x) => x !== d.id && ids.has(x));
  const out = [];
  for (let k = 0; out.length < Math.min(3, pool.length) && k < 20; k++) {
    const c = pool[(hash(d.id) + k) % pool.length];
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

// ---------- build ----------
const ids = new Set(catalogue.map((d) => d.id));
const dishesByCat = new Map(CATEGORIES.map(([id]) => [id, []]));
const report = { dishes: 0, artwork: 0, noArtwork: [] };

for (const d of catalogue) {
  const prof = profileFor(d);
  const bl = backlogById.get(d.id);
  const prot = protein(d);
  const egg = isEgg(d);
  const cat = categoryOf(d);
  const spice = prof?.culinary?.spiceLevel ?? spiceOf(d, cat, prot);
  const ingredients = prof?.safety?.ingredients?.length
    ? prof.safety.ingredients
    : ingredientFor(d, cat, prot, egg, bl?.regional_association?.toLowerCase());
  const allergens = prof?.safety?.allergens?.length
    ? prof.safety.allergens
    : allergensOf(ingredients, d.name);
  const nonVeg = Boolean(prot) || nonVegHint(d) === "non_vegetarian";
  const dietary = [];
  if (prof?.dietary?.length)
    dietary.push(...prof.dietary.filter((x) => ["vegetarian", "vegan", "gluten_free"].includes(x)));
  else {
    const vegetarian = !nonVeg && !egg && nonVegHint(d) !== "egg";
    if (vegetarian) dietary.push("vegetarian");
    if (
      vegetarian &&
      !/sadya|thali|combo|baati|stew|kheer|payasam/i.test(d.name) &&
      !allergens.includes("dairy") &&
      !allergens.includes("eggs") &&
      !/honey|ghee|paneer|butter|yogurt|milk/i.test(ingredients.join(" "))
    )
      dietary.push("vegan");
    if (
      !allergens.includes("gluten") &&
      !/noodle|bread|wheat|soy sauce|pav|bun/i.test(ingredients.join(" "))
    )
      dietary.push("gluten_free");
  }
  const dietaryUnique = [...new Set(dietary)];
  const price = prof
    ? Math.round((base[cat].price * (prot ? protMult[prot] : 1)) / 10) * 10 - 1
    : priceOf(d, cat, prot);
  const art = artworkFor(d);
  report.dishes++;
  if (art) report.artwork++;
  else report.noArtwork.push(`${d.id} ${d.name}`);
  const region = bl?.regional_association ?? (d.id.includes("CORE") ? "Pan-India" : "India");
  const culinary = {
    spiceLevel: spice,
    flavorNotes: (prof?.culinary?.flavorNotes?.length
      ? prof.culinary.flavorNotes
      : flavors(d, cat, spice)
    )
      .map((x) => x.slice(0, 30))
      .slice(0, 6),
    chefNote: (prof?.culinary?.chefNote ?? chefNote(d, cat, prot, spice, region)).slice(0, 300),
    servingTemp: prof?.culinary?.servingTemp ?? temp(d),
    pairingDishIds: pairingsOf(d, cat, ids),
  };
  const nutrition = prof?.nutrition
    ? { ...prof.nutrition, verified: false }
    : nutritionOf(d, cat, prot, spice);
  const variants = variantsOf(d, cat, price);
  const dish = {
    id: d.id,
    name: d.name,
    description: descriptionOf(d, region, bl?.visual_anchor, cat, prot),
    priceMinor: money(price),
    soldOut: false,
    archived: false,
    mediaId: null,
    artworkId: art ? art.id : null,
    // Dishes without an approved illustration show the generic plate placeholder until art exists.
    imageMode: art ? "artwork" : "none",
    dietary: dietaryUnique,
    nutrition,
    culinary,
    safety: {
      ingredients,
      allergens,
      crossContact:
        "Prepared in a shared kitchen; traces of other allergens may be present. Sample data, not verified.",
      verified: false,
    },
    variants,
    addOnGroups: addOnsOf(d, cat, spice, prot, !nonVeg),
    schedule: null,
  };
  dishesByCat.get(cat).push(dish);
}

const featured = [
  "MM-CORE-butter-chicken",
  "MM-CORE-biryani",
  "MM-CORE-paneer-tikka",
  "MM-CORE-masala-dosa",
  "MM-IN-001",
  "MM-IN-184",
  "MM-CORE-pizza-margherita",
  "MM-IN-016",
].filter((x) => ids.has(x));
const doc = {
  name: "Spice Route Kitchen",
  currency: "INR",
  schedule: null,
  presentation: {
    cover: "indian-restaurant",
    headline: "236 dishes from every corner of India and beyond",
    featuredDishIds: featured,
  },
  categories: CATEGORIES.map(([id, name, description]) => ({
    id,
    name,
    description,
    archived: false,
    items: dishesByCat.get(id).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((c) => c.items.length),
};
writeFileSync(join(root, "src/data/demo/demo-menu.json"), JSON.stringify(doc) + "\n");
console.log(
  `dishes=${report.dishes} withArtwork=${report.artwork} withoutArtwork=${report.noArtwork.length}`
);
console.log(doc.categories.map((c) => `${c.name}: ${c.items.length}`).join("\n"));
writeFileSync(join(root, "src/data/demo/artwork-gaps.txt"), report.noArtwork.join("\n") + "\n");
