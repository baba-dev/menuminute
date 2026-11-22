import { FoodEntrySchema, type FoodEntry, type FoodKind, foodPath } from "./contracts";

/**
 * Design handoff profiles. All entries are PREVIEW ONLY: not independently fact-checked,
 * licensed as editorial source material, or eligible for search indexing / advertising.
 * They demonstrate the approved Atlas hierarchy until reviewed editorial records exist.
 */
const previewEntries: FoodEntry[] = [
  {
    id: "atlas-preview-paneer-tikka",
    kind: "dishes",
    slug: "paneer-tikka",
    title: "Paneer Tikka",
    eyebrow: "NORTH INDIAN / STARTERS",
    description:
      "A smoky, spiced paneer appetizer commonly grilled with vegetables. Explore the ingredients, flavor and cooking traditions behind the dish.",
    imagePath: "/assets/food/dishes/indian/paneer-tikka.png",
    imageAlt: "MenuMinute illustration of grilled paneer tikka served with vegetables",
    tint: "peach",
    status: "preview",
    aliases: ["पनीर टिक्का", "paneer tikka starter", "grilled paneer"],
    facts: [
      { label: "Typical flavor", value: "Smoky · tangy · spiced" },
      { label: "Texture", value: "Tender · lightly charred" },
      { label: "Common ingredient", value: "Paneer (milk cheese)" },
      { label: "Cooking method", value: "Tandoor or grill" },
    ],
    sections: [
      {
        id: "what",
        eyebrow: "01 / UNDERSTANDING THE DISH",
        title: "What is Paneer Tikka?",
        body: [
          "Paneer tikka is usually prepared by coating cubes of paneer in a seasoned marinade and cooking them over relatively high heat. The exterior becomes aromatic and lightly charred while the center remains tender.",
          "It is often served as an appetizer with onions, peppers, chutney or lemon. Specific restaurant preparations vary.",
        ],
      },
      {
        id: "ingredients",
        eyebrow: "02 / INGREDIENTS",
        title: "What typically goes into it?",
        body: [
          "Paneer, yogurt, ginger, garlic and spice blends are common ingredients. Some preparations add peppers, onions, mustard oil or other seasonings. Exact ingredients depend on the recipe.",
        ],
      },
      {
        id: "flavor",
        eyebrow: "03 / TASTE & TEXTURE",
        title: "What does it taste like?",
        body: [
          "The result often combines tangy marinade, a gentle smoky note and warm spice. The pieces should have a soft cheese texture rather than the texture of grilled meat.",
        ],
      },
      {
        id: "variations",
        eyebrow: "04 / VARIATIONS",
        title: "Tikka or tikka masala?",
        body: [
          "Paneer tikka usually refers to marinated, cooked pieces of paneer served as an appetizer. Paneer tikka masala more commonly describes paneer pieces served in a sauce or gravy as a main course.",
        ],
      },
    ],
    relatedSlugs: ["biryani", "kasuri-methi", "naan-vs-roti"],
    caution:
      "Paneer is a dairy product; marinades commonly contain yogurt. Other allergens and cross-contact vary. If you have a food allergy, ask the restaurant about its exact recipe and food handling.",
    sourceUrls: [],
  },
  {
    id: "atlas-preview-masala-dosa",
    kind: "dishes",
    slug: "masala-dosa",
    title: "Masala Dosa",
    eyebrow: "SOUTH INDIAN / BREAKFAST",
    description:
      "A crisp fermented crepe commonly wrapped around a warm potato filling, served with chutneys and sambar.",
    imagePath: "/assets/food/dishes/indian/masala-dosa.png",
    imageAlt: "MenuMinute illustration of a masala dosa with traditional accompaniments",
    tint: "sage",
    status: "preview",
    aliases: ["मसाला डोसा", "dosa", "potato dosa"],
    facts: [
      { label: "Style", value: "Filled fermented crepe" },
      { label: "Common filling", value: "Spiced potatoes" },
      { label: "Texture", value: "Crisp exterior" },
      { label: "Often served with", value: "Chutneys · sambar" },
    ],
    sections: [
      {
        id: "what",
        eyebrow: "01 / THE DISH",
        title: "What is Masala Dosa?",
        body: [
          "Masala dosa is a South Indian dish built around a thin crepe, often made from fermented rice and lentil batter. A savory potato filling is added before the crepe is folded or rolled.",
        ],
      },
      {
        id: "flavor",
        eyebrow: "02 / THE EXPERIENCE",
        title: "What makes it special?",
        body: [
          "The contrast between the crisp crepe, soft filling and bright accompaniments is part of its appeal. Styles differ by region and restaurant.",
        ],
      },
      {
        id: "serving",
        eyebrow: "03 / HOW IT'S SERVED",
        title: "What comes alongside it?",
        body: [
          "Coconut or other chutneys and a bowl of sambar are frequently offered, but their recipes, ingredients and spice levels are not standardized.",
        ],
      },
    ],
    relatedSlugs: ["paneer-tikka", "biryani"],
    caution:
      "Common batters use rice and lentils, but fats, fillings, chutneys and cross-contact vary. Ask the restaurant to confirm any allergen concern.",
    sourceUrls: [],
  },
  {
    id: "atlas-preview-biryani",
    kind: "dishes",
    slug: "biryani",
    title: "Biryani",
    eyebrow: "RICE & GRAINS / DISH",
    description:
      "A family of aromatic layered or mixed rice dishes, with spices, regional variations and many possible proteins or vegetables.",
    imagePath: "/assets/food/dishes/indian/biryani.png",
    imageAlt: "MenuMinute illustration of a serving of fragrant biryani",
    tint: "cream",
    status: "preview",
    aliases: ["बिरयानी", "biriyani", "biryani rice"],
    facts: [
      { label: "Base", value: "Fragrant cooked rice" },
      { label: "Seasonings", value: "Varies by region" },
      { label: "Variations", value: "Vegetarian and non-vegetarian" },
      { label: "Serving", value: "Often a main course" },
    ],
    sections: [
      {
        id: "what",
        eyebrow: "01 / THE DISH",
        title: "What makes a biryani?",
        body: [
          "Biryani refers to many South Asian rice preparations featuring fragrant rice, spices and other ingredients. Cooking techniques and layering approaches differ markedly across culinary traditions.",
        ],
      },
      {
        id: "regional",
        eyebrow: "02 / REGIONAL STYLES",
        title: "One name, many traditions",
        body: [
          "Distinct regional styles vary in ingredient choices, cooking vessels, heat, accompaniments and texture. Descriptions should avoid declaring a single version the only authentic biryani.",
        ],
      },
      {
        id: "serving",
        eyebrow: "03 / AT THE TABLE",
        title: "How is it served?",
        body: [
          "Biryani is commonly served as a complete meal, sometimes with raita, pickles or other sides. Menu descriptions should make the principal ingredients clear.",
        ],
      },
    ],
    relatedSlugs: ["masala-dosa", "paneer-tikka", "rajasthani"],
    caution:
      "Ingredients may include meat, dairy, nuts or other allergens depending on the recipe. A dish name does not establish dietary suitability.",
    sourceUrls: [],
  },
  {
    id: "atlas-preview-samosa",
    kind: "dishes",
    slug: "samosa",
    title: "Samosa",
    eyebrow: "STREET FOOD / SNACKS",
    description:
      "A filled pastry commonly deep-fried until crisp, enjoyed with chutneys and countless regional fillings.",
    imagePath: "/assets/food/dishes/indian/samosa.png",
    imageAlt: "MenuMinute illustration of a golden triangular samosa",
    tint: "blue",
    status: "preview",
    aliases: ["समोसा", "samosas"],
    facts: [
      { label: "Preparation", value: "Filled pastry" },
      { label: "Texture", value: "Crisp shell" },
      { label: "Common filling", value: "Seasoned potatoes" },
      { label: "Often served with", value: "Chutneys" },
    ],
    sections: [
      {
        id: "what",
        eyebrow: "01 / THE DISH",
        title: "What is a samosa?",
        body: [
          "A samosa is a small filled pastry that can be fried or baked. Its shape, pastry, fillings and seasoning vary significantly across regions and kitchens.",
        ],
      },
      {
        id: "ingredients",
        eyebrow: "02 / FILLINGS",
        title: "What might be inside?",
        body: [
          "Many Indian versions contain a spiced potato filling, sometimes with peas. Other versions use lentils, meat, cheese or different vegetables.",
        ],
      },
    ],
    relatedSlugs: ["masala-dosa", "paneer-tikka"],
    caution:
      "Wheat, shared frying oil and filling ingredients can matter for allergies. Individual restaurants must confirm their preparations.",
    sourceUrls: [],
  },
  {
    id: "atlas-preview-dal-baati-churma",
    kind: "dishes",
    slug: "dal-baati-churma",
    title: "Dal Baati Churma",
    eyebrow: "RAJASTHAN / REGIONAL DISH",
    description:
      "A Rajasthani combination of dal, baked wheat baati and a sweet, crumbly churma accompaniment.",
    imagePath: "/assets/food/dishes/north-indian-rajasthani/dal-baati-churma.png",
    imageAlt: "MenuMinute artwork showing a dal baati churma meal",
    tint: "sage",
    status: "preview",
    aliases: ["दाल बाटी चूरमा", "dal bati churma"],
    facts: [
      { label: "Cuisine", value: "Rajasthani" },
      { label: "Components", value: "Dal · baati · churma" },
      { label: "Common grain", value: "Wheat" },
      { label: "Serving", value: "Often a full meal" },
    ],
    sections: [
      {
        id: "what",
        eyebrow: "01 / REGIONAL FAVORITES",
        title: "What is Dal Baati Churma?",
        body: [
          "Dal baati churma combines seasoned lentils, baked wheat dumplings and a sweet crumbly component. The meal may be enriched with ghee and served in different combinations.",
        ],
      },
      {
        id: "regional",
        eyebrow: "02 / CULTURAL CONTEXT",
        title: "How is it enjoyed?",
        body: [
          "It is associated with Rajasthan and nearby culinary traditions. Recipes and the way it is presented can differ by family, locality and restaurant.",
        ],
      },
    ],
    relatedSlugs: ["rajasthani", "naan-vs-roti", "biryani"],
    caution:
      "Traditional preparations commonly contain wheat and may use dairy. Check the restaurant or cook about exact ingredients.",
    sourceUrls: [],
  },
  {
    id: "atlas-preview-kasuri-methi",
    kind: "ingredients",
    slug: "kasuri-methi",
    title: "Kasuri Methi",
    eyebrow: "INGREDIENT / HERBS & SPICES",
    description:
      "A small herb with a big personality. Learn what dried fenugreek leaves are and why they appear in many Indian dishes.",
    tint: "sage",
    status: "preview",
    aliases: ["कसूरी मेथी", "dried fenugreek", "dried methi leaves"],
    facts: [
      { label: "Ingredient", value: "Dried fenugreek leaves" },
      { label: "Flavor", value: "Herbal · earthy · slightly bitter" },
      { label: "Usage", value: "Seasoning & finishing" },
      { label: "Other name", value: "Dried methi leaves" },
    ],
    sections: [
      {
        id: "what",
        eyebrow: "01 / THE DEFINITION",
        title: "What is Kasuri Methi?",
        body: [
          "Kasuri methi is made from dried fenugreek leaves. The leaves are often crumbled by hand and added to dishes during cooking or just before serving for a distinct aroma.",
        ],
      },
      {
        id: "flavor",
        eyebrow: "02 / THE FLAVOR",
        title: "What does it taste like?",
        body: [
          "The flavor is herbal and earthy, sometimes with a slightly bitter edge. The amount used can alter the final flavor noticeably.",
        ],
      },
      {
        id: "uses",
        eyebrow: "03 / IN THE KITCHEN",
        title: "Where might it appear?",
        body: [
          "It is often used in Indian curries, vegetable dishes and rich gravies. Dried leaves should not be confused with fenugreek seeds, which have different culinary characteristics.",
        ],
      },
    ],
    relatedSlugs: ["paneer-tikka", "rajasthani"],
    caution:
      "Ingredient explanations are general; individual foods may contain other allergens or seasonings not listed here.",
    sourceUrls: [],
  },
  {
    id: "atlas-preview-rajasthani",
    kind: "cuisines",
    slug: "rajasthani",
    title: "The Flavors of Rajasthan",
    eyebrow: "CUISINE ATLAS / INDIA",
    description:
      "Explore Rajasthani cooking traditions, ingredient choices and regional specialties with a practical introduction to foods of the region.",
    imagePath: "/assets/food/dishes/north-indian-rajasthani/dal-baati-churma.png",
    imageAlt: "MenuMinute editorial artwork of dal baati churma",
    tint: "blue",
    status: "preview",
    aliases: ["rajasthani cuisine", "rajasthan food", "राजस्थानी खाना"],
    facts: [
      { label: "Place", value: "Rajasthan, India" },
      { label: "Signature dish", value: "Dal Baati Churma" },
      { label: "Staples", value: "Grains · pulses · spices" },
      { label: "Regional notes", value: "Many distinct local cuisines" },
    ],
    sections: [
      {
        id: "what",
        eyebrow: "01 / REGIONAL COOKING",
        title: "What defines Rajasthani cuisine?",
        body: [
          "Rajasthan has diverse food traditions shaped by geography, local ingredients, communities and changing lifestyles. The region is associated with dishes such as dal baati churma and gatte ki sabzi, but no single menu represents every community.",
        ],
      },
      {
        id: "flavor",
        eyebrow: "02 / PANTRY & TECHNIQUE",
        title: "Ingredients and ingenuity",
        body: [
          "Grains, pulses, spices and preserved ingredients appear in many preparations. Food habits differ between households and across the state.",
        ],
      },
      {
        id: "explore",
        eyebrow: "03 / KEEP EXPLORING",
        title: "Dishes to discover",
        body: [
          "Dal baati churma, pyaaz kachori and ker sangri are useful starting points for learning about this broad and varied food culture.",
        ],
      },
    ],
    relatedSlugs: ["dal-baati-churma", "biryani", "kasuri-methi"],
    sourceUrls: [],
  },
  {
    id: "atlas-preview-naan-vs-roti",
    kind: "compare",
    slug: "naan-vs-roti",
    title: "Naan vs Roti",
    eyebrow: "FOOD COMPARISON / FLATBREADS",
    description:
      "Two familiar South Asian flatbreads can differ in dough, cooking technique and texture. Learn the typical distinctions and exceptions.",
    imagePath: "/assets/food/dishes/indian/naan.png",
    imageAlt: "MenuMinute artwork showing naan flatbread",
    tint: "lavender",
    status: "preview",
    aliases: ["roti vs naan", "difference naan roti"],
    facts: [
      { label: "Naan", value: "Often leavened" },
      { label: "Roti", value: "Typically unleavened" },
      { label: "Naan cooking", value: "Often tandoor or oven" },
      { label: "Roti cooking", value: "Often tawa or griddle" },
    ],
    sections: [
      {
        id: "overview",
        eyebrow: "01 / QUICK COMPARISON",
        title: "What is the difference?",
        body: [
          "Naan and roti are both South Asian flatbreads, but their typical doughs, thickness, textures and cooking methods differ. There are many regional variations and restaurant adaptations.",
        ],
      },
      {
        id: "naan",
        eyebrow: "02 / NAAN",
        title: "A softer, often leavened bread",
        body: [
          "Naan is commonly made from wheat flour and may include leavening and other ingredients. It is often associated with cooking on the walls of a hot tandoor, though contemporary methods vary.",
        ],
      },
      {
        id: "roti",
        eyebrow: "03 / ROTI",
        title: "An everyday flatbread",
        body: [
          "Roti is commonly an unleavened wheat flatbread cooked on a flat griddle. Some regional types use other grains and cooking techniques.",
        ],
      },
    ],
    relatedSlugs: ["dal-baati-churma", "paneer-tikka"],
    caution:
      "Naan or roti may include different ingredients at different restaurants, including dairy or egg. Never infer allergy safety from a name.",
    sourceUrls: [],
  },
].map((entry) => FoodEntrySchema.parse(entry));

/** Stable bounded fixture set; no database, tenant or AI side effects. */
export function allFoodPreviews(): readonly FoodEntry[] {
  return previewEntries;
}
export function getFoodEntry(kind: FoodKind, slug: string): FoodEntry | undefined {
  return previewEntries.find((entry) => entry.kind === kind && entry.slug === slug);
}
export function getRelatedFood(entry: FoodEntry, limit = 4): FoodEntry[] {
  return entry.relatedSlugs
    .flatMap((slug) => {
      const match = previewEntries.find((candidate) => candidate.slug === slug);
      return match ? [match] : [];
    })
    .filter((candidate) => candidate.id !== entry.id)
    .slice(0, Math.min(Math.max(limit, 0), 8));
}
export function getFoodBySlug(slug: string): FoodEntry | undefined {
  return previewEntries.find((entry) => entry.slug === slug);
}
export const publishedFoodEntries = previewEntries.filter(
  (entry) =>
    entry.status === "published" &&
    entry.sourceUrls.length > 0 &&
    Boolean(entry.reviewedBy && entry.reviewedAt && entry.publishedAt)
);
export const foodPreviewRoutes = previewEntries.map(foodPath);
