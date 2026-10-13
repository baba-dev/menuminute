/**
 * Development seed script.
 * Run with: pnpm db:seed
 *
 * Creates ONE fictional demo restaurant ("Spice Route Kitchen") with a
 * realistic Indian menu. All data is clearly marked as DEMONSTRATION DATA.
 *
 * This script is IDEMPOTENT — running it multiple times will not create
 * duplicate records (uses publicId as the idempotency key).
 *
 * ⚠️  NEVER run this script against a production database.
 */
import { getDb, closeDb } from "../src/db/index";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  restaurants,
  restaurantMembers,
  qrCodes,
  menuCategories,
  menuItems,
  users,
  subscriptionPlans,
  restaurantSubscriptions,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import path from "path";

const DEMO_RESTAURANT_PUBLIC_ID = "demo-spice-route-kitchen-v1";
const DEMO_USER_EMAIL = "demo@menuminute.com";

async function seed() {
  console.warn("🌱 Starting database seed...");

  const db = getDb();

  // Run migrations first
  const migrationsFolder = path.join(process.cwd(), "src", "db", "migrations");
  migrate(db, { migrationsFolder });
  console.warn("✅ Migrations applied.");

  // ─── Idempotency check ───────────────────────────────────────────────────
  const existing = db
    .select()
    .from(restaurants)
    .where(eq(restaurants.publicId, DEMO_RESTAURANT_PUBLIC_ID))
    .get();

  if (existing) {
    console.warn(`ℹ️  Demo restaurant already exists (id=${existing.id}). Skipping seed.`);
    closeDb();
    return;
  }

  // ─── Subscription Plans ───────────────────────────────────────────────────
  console.warn("Creating subscription plans...");
  db.insert(subscriptionPlans)
    .values([
      {
        id: "plan-free",
        name: "free",
        displayName: "Free Forever",
        monthlyPricePaise: 0,
        features: JSON.stringify(["qr_menu", "menu_management", "qr_codes"]),
        sortOrder: 1,
      },
      {
        id: "plan-ordering",
        name: "ordering",
        displayName: "Online Ordering",
        monthlyPricePaise: 14900, // ₹149
        features: JSON.stringify([
          "qr_menu",
          "menu_management",
          "qr_codes",
          "table_ordering",
          "order_management",
          "order_tracking",
        ]),
        sortOrder: 2,
      },
      {
        id: "plan-kitchen-pro",
        name: "kitchen_pro",
        displayName: "Kitchen Pro",
        monthlyPricePaise: 29900, // ₹299
        features: JSON.stringify([
          "qr_menu",
          "menu_management",
          "qr_codes",
          "table_ordering",
          "order_management",
          "order_tracking",
          "kitchen_display",
          "staff_management",
          "reports",
          "audio_notifications",
        ]),
        sortOrder: 3,
      },
    ])
    .onConflictDoNothing()
    .run();

  // ─── Demo Owner User ──────────────────────────────────────────────────────
  console.warn("Creating demo user...");
  const passwordHash = await bcrypt.hash("demo-password-change-me", 12);

  const demoUser = db
    .insert(users)
    .values({
      id: "user-demo-owner-001",
      email: DEMO_USER_EMAIL,
      name: "Demo Owner",
      passwordHash,
      role: "user",
      isDemoData: true,
    } as typeof users.$inferInsert)
    .onConflictDoNothing()
    .returning()
    .get();

  const userId = demoUser?.id ?? "user-demo-owner-001";

  // ─── Demo Restaurant ──────────────────────────────────────────────────────
  console.warn("Creating demo restaurant: Spice Route Kitchen...");
  const restaurant = db
    .insert(restaurants)
    .values({
      id: "rest-demo-spice-route-001",
      publicId: DEMO_RESTAURANT_PUBLIC_ID,
      name: "Spice Route Kitchen",
      slug: "spice-route-kitchen",
      description:
        "Authentic North Indian cuisine with a modern twist. Family recipes passed down through generations, served with love.",
      phone: "+91 98765 43210",
      email: "hello@spiceroutekitchen.demo",
      website: "https://spiceroutekitchen.demo",
      addressLine1: "12, MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
      primaryColor: "#f97316",
      secondaryColor: "#1c1917",
      currency: "INR",
      isActive: true,
      isDemoData: true,
    })
    .returning()
    .get();

  // ─── Restaurant Membership ─────────────────────────────────────────────────
  db.insert(restaurantMembers)
    .values({
      id: "member-demo-001",
      restaurantId: restaurant.id,
      userId,
      role: "owner",
      isActive: true,
      joinedAt: new Date(),
    })
    .onConflictDoNothing()
    .run();

  // ─── Subscription ─────────────────────────────────────────────────────────
  db.insert(restaurantSubscriptions)
    .values({
      id: "sub-demo-001",
      restaurantId: restaurant.id,
      planId: "plan-free",
      status: "active",
    })
    .onConflictDoNothing()
    .run();

  // ─── QR Code ──────────────────────────────────────────────────────────────
  db.insert(qrCodes)
    .values({
      id: "qr-demo-menu-001",
      restaurantId: restaurant.id,
      purpose: "menu",
      label: "Main Menu QR",
      destinationToken: DEMO_RESTAURANT_PUBLIC_ID,
      isActive: true,
    })
    .onConflictDoNothing()
    .run();

  // ─── Menu Categories ───────────────────────────────────────────────────────
  console.warn("Creating menu categories...");
  const categories = db
    .insert(menuCategories)
    .values([
      {
        id: "cat-demo-starters",
        restaurantId: restaurant.id,
        name: "Starters & Soups",
        description: "Light bites and warming soups to begin your meal",
        sortOrder: 1,
        isActive: true,
      },
      {
        id: "cat-demo-breads",
        restaurantId: restaurant.id,
        name: "Breads",
        description: "Fresh from our tandoor",
        sortOrder: 2,
        isActive: true,
      },
      {
        id: "cat-demo-veg-mains",
        restaurantId: restaurant.id,
        name: "Vegetarian Mains",
        description: "Rich gravies and flavorful preparations",
        sortOrder: 3,
        isActive: true,
      },
      {
        id: "cat-demo-nonveg-mains",
        restaurantId: restaurant.id,
        name: "Non-Vegetarian Mains",
        description: "Slow-cooked meats and seafood curries",
        sortOrder: 4,
        isActive: true,
      },
      {
        id: "cat-demo-rice-biryani",
        restaurantId: restaurant.id,
        name: "Rice & Biryani",
        description: "Aromatic rice dishes and layered biryanis",
        sortOrder: 5,
        isActive: true,
      },
      {
        id: "cat-demo-desserts",
        restaurantId: restaurant.id,
        name: "Desserts",
        description: "Traditional Indian sweets to end on a high note",
        sortOrder: 6,
        isActive: true,
      },
      {
        id: "cat-demo-beverages",
        restaurantId: restaurant.id,
        name: "Beverages",
        description: "Refreshing drinks and hot beverages",
        sortOrder: 7,
        isActive: true,
      },
    ])
    .returning()
    .all();

  // ─── Menu Items ───────────────────────────────────────────────────────────
  console.warn("Creating menu items...");
  db.insert(menuItems)
    .values([
      // Starters
      {
        id: "item-demo-001",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-starters",
        name: "Paneer Tikka",
        description:
          "Marinated cottage cheese cubes grilled in a tandoor, served with mint chutney and sliced onions",
        pricePaise: 29900, // ₹299
        isVeg: true,
        isVegan: false,
        spiceLevel: 2,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 1,
        isDemoData: true,
      },
      {
        id: "item-demo-002",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-starters",
        name: "Chicken 65",
        description:
          "Crispy deep-fried chicken marinated with aromatic spices, curry leaves and green chillies",
        pricePaise: 34900, // ₹349
        isVeg: false,
        spiceLevel: 3,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 2,
        isDemoData: true,
      },
      {
        id: "item-demo-003",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-starters",
        name: "Tomato Shorba",
        description: "Spiced tomato soup with fresh cream and coriander",
        pricePaise: 19900, // ₹199
        isVeg: true,
        isVegan: false,
        spiceLevel: 1,
        isAvailable: true,
        sortOrder: 3,
        isDemoData: true,
      },
      {
        id: "item-demo-004",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-starters",
        name: "Hara Bhara Kabab",
        description: "Crispy patties made with spinach, green peas, potatoes and spices",
        pricePaise: 24900, // ₹249
        isVeg: true,
        isVegan: true,
        spiceLevel: 1,
        isAvailable: true,
        sortOrder: 4,
        isDemoData: true,
      },
      // Breads
      {
        id: "item-demo-005",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-breads",
        name: "Butter Naan",
        description: "Soft leavened bread brushed with butter, baked in tandoor",
        pricePaise: 6900, // ₹69
        isVeg: true,
        isVegan: false,
        spiceLevel: 0,
        isAvailable: true,
        sortOrder: 1,
        isDemoData: true,
      },
      {
        id: "item-demo-006",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-breads",
        name: "Garlic Naan",
        description: "Naan topped with garlic and butter — a crowd favourite",
        pricePaise: 7900, // ₹79
        isVeg: true,
        isVegan: false,
        spiceLevel: 0,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 2,
        isDemoData: true,
      },
      {
        id: "item-demo-007",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-breads",
        name: "Tandoori Roti",
        description: "Whole wheat bread baked fresh in the clay oven",
        pricePaise: 4900, // ₹49
        isVeg: true,
        isVegan: true,
        spiceLevel: 0,
        isAvailable: true,
        sortOrder: 3,
        isDemoData: true,
      },
      // Veg Mains
      {
        id: "item-demo-008",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-veg-mains",
        name: "Dal Makhani",
        description:
          "Slow-cooked black lentils and kidney beans in a rich tomato-butter-cream sauce. Simmered overnight.",
        pricePaise: 27900, // ₹279
        isVeg: true,
        isVegan: false,
        spiceLevel: 1,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 1,
        isDemoData: true,
      },
      {
        id: "item-demo-009",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-veg-mains",
        name: "Paneer Butter Masala",
        description: "Cottage cheese in a velvety tomato-cashew gravy with aromatic spices",
        pricePaise: 32900, // ₹329
        isVeg: true,
        isVegan: false,
        spiceLevel: 1,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 2,
        isDemoData: true,
      },
      {
        id: "item-demo-010",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-veg-mains",
        name: "Palak Paneer",
        description: "Fresh cottage cheese cubes in a vibrant spinach gravy",
        pricePaise: 29900, // ₹299
        isVeg: true,
        isVegan: false,
        spiceLevel: 2,
        isAvailable: true,
        sortOrder: 3,
        isDemoData: true,
      },
      {
        id: "item-demo-011",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-veg-mains",
        name: "Chana Masala",
        description: "Chickpeas cooked in a tangy, spiced tomato-onion gravy with amchur",
        pricePaise: 22900, // ₹229
        isVeg: true,
        isVegan: true,
        spiceLevel: 2,
        isAvailable: true,
        sortOrder: 4,
        isDemoData: true,
      },
      // Non-Veg Mains
      {
        id: "item-demo-012",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-nonveg-mains",
        name: "Butter Chicken",
        description:
          "Tender chicken in our signature mild tomato-butter-cream sauce. Legendarily popular.",
        pricePaise: 37900, // ₹379
        isVeg: false,
        spiceLevel: 1,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 1,
        isDemoData: true,
      },
      {
        id: "item-demo-013",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-nonveg-mains",
        name: "Rogan Josh",
        description: "Slow-braised Kashmiri lamb in a bold red sauce with whole spices",
        pricePaise: 44900, // ₹449
        isVeg: false,
        spiceLevel: 2,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 2,
        isDemoData: true,
      },
      {
        id: "item-demo-014",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-nonveg-mains",
        name: "Goan Fish Curry",
        description: "Fresh catch of the day in a coconut-tamarind gravy with Goan spices",
        pricePaise: 42900, // ₹429
        isVeg: false,
        spiceLevel: 3,
        isAvailable: true,
        sortOrder: 3,
        isDemoData: true,
      },
      // Rice & Biryani
      {
        id: "item-demo-015",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-rice-biryani",
        name: "Chicken Dum Biryani",
        description:
          "Fragrant basmati rice and tender chicken, slow-cooked sealed in a handi with saffron and caramelised onions",
        pricePaise: 42900, // ₹429
        isVeg: false,
        spiceLevel: 2,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 1,
        isDemoData: true,
      },
      {
        id: "item-demo-016",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-rice-biryani",
        name: "Vegetable Dum Biryani",
        description:
          "Seasonal vegetables and basmati rice layered with caramelised onions, herbs and saffron",
        pricePaise: 32900, // ₹329
        isVeg: true,
        isVegan: false,
        spiceLevel: 1,
        isAvailable: true,
        sortOrder: 2,
        isDemoData: true,
      },
      {
        id: "item-demo-017",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-rice-biryani",
        name: "Steamed Basmati Rice",
        description: "Plain fragrant basmati rice",
        pricePaise: 9900, // ₹99
        isVeg: true,
        isVegan: true,
        spiceLevel: 0,
        isAvailable: true,
        sortOrder: 3,
        isDemoData: true,
      },
      // Desserts
      {
        id: "item-demo-018",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-desserts",
        name: "Gulab Jamun",
        description: "Soft milk-solid dumplings soaked in rose-cardamom sugar syrup, served warm",
        pricePaise: 17900, // ₹179
        isVeg: true,
        isVegan: false,
        spiceLevel: 0,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 1,
        isDemoData: true,
      },
      {
        id: "item-demo-019",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-desserts",
        name: "Kulfi",
        description:
          "Traditional Indian ice cream — dense, creamy and flavored with pistachio and cardamom",
        pricePaise: 19900, // ₹199
        isVeg: true,
        isVegan: false,
        spiceLevel: 0,
        isAvailable: true,
        sortOrder: 2,
        isDemoData: true,
      },
      {
        id: "item-demo-020",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-desserts",
        name: "Gajar Halwa",
        description:
          "Slow-cooked carrot pudding with ghee, milk, sugar and cardamom, topped with nuts",
        pricePaise: 22900, // ₹229
        isVeg: true,
        isVegan: false,
        spiceLevel: 0,
        isAvailable: true,
        sortOrder: 3,
        isDemoData: true,
      },
      // Beverages
      {
        id: "item-demo-021",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-beverages",
        name: "Mango Lassi",
        description: "Thick, chilled yogurt drink blended with Alphonso mangoes",
        pricePaise: 14900, // ₹149
        isVeg: true,
        isVegan: false,
        spiceLevel: 0,
        isFeatured: true,
        isAvailable: true,
        sortOrder: 1,
        isDemoData: true,
      },
      {
        id: "item-demo-022",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-beverages",
        name: "Masala Chai",
        description: "Spiced tea brewed with ginger, cardamom, cloves and milk",
        pricePaise: 9900, // ₹99
        isVeg: true,
        isVegan: false,
        spiceLevel: 0,
        isAvailable: true,
        sortOrder: 2,
        isDemoData: true,
      },
      {
        id: "item-demo-023",
        restaurantId: restaurant.id,
        categoryId: "cat-demo-beverages",
        name: "Nimbu Pani",
        description: "Fresh lime water with a pinch of cumin salt — classic roadside style",
        pricePaise: 7900, // ₹79
        isVeg: true,
        isVegan: true,
        spiceLevel: 0,
        isAvailable: true,
        sortOrder: 3,
        isDemoData: true,
      },
    ])
    .onConflictDoNothing()
    .run();

  console.warn(`
✅ Seed complete!

📍 Demo Restaurant: Spice Route Kitchen
   ID: ${restaurant.id}
   Public ID: ${restaurant.publicId}
   Public Menu: /m/${DEMO_RESTAURANT_PUBLIC_ID}

👤 Demo Owner Account:
   Email: ${DEMO_USER_EMAIL}
   Password: demo-password-change-me

🍽️  Menu: 23 items across 7 categories

⚠️  This is DEMONSTRATION DATA. Do not use in production.
`);

  closeDb();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
