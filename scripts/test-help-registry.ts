import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
process.env.APP_URL = "http://localhost:3000";
process.env.AUTH_SECRET = randomBytes(32).toString("hex");
process.env.DATABASE_URL = "postgresql://menuminute_app:local-test@127.0.0.1:5432/menuminute_test";
process.env.REDIS_QUEUE_URL = "redis://127.0.0.1:6379";
process.env.REDIS_CACHE_URL = "redis://127.0.0.1:6380";
process.env.ORDER_EDGE_SHARED_SECRET = randomBytes(32).toString("hex");
process.env.MEDIA_STORAGE = "local";
process.env.MEDIA_ROOT = process.cwd();
process.env.MEDIA_OUTLET_BUDGET_BYTES = "104857600";
process.env.AUTH_ALLOW_TEST_EMAIL = "true";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const {
    allArticles,
    ownerArticles,
    customerArticles,
    allFaqs,
    getArticleBySlug,
    getArticlesByAudience,
    getCategories,
    searchHelpArticles,
    searchFaqs,
  } = await import("../src/content/help");
  const { selectQuestionTools } = await import("../src/modules/intelligence/tool-selection");
  const { groundedMerchantAnswer } = await import("../src/modules/intelligence/grounded-answer");
  const { toolDefinitions } = await import("../src/modules/intelligence/read-tools");
  const sitemap = (await import("../src/app/sitemap")).default;
  const robots = (await import("../src/app/robots")).default;

  console.log("=== Running Help Documentation, Ember AI, & SEO Verification ===");

  // 1. Article Registry Validation
  console.log("\n1. Validating Help Article Catalog...");
  check(allArticles.length === 16, "Must contain exactly 16 articles");
  check(ownerArticles.length === 10, "Must contain exactly 10 owner articles");
  check(customerArticles.length === 6, "Must contain exactly 6 customer articles");

  const slugs = new Set<string>();
  for (const article of allArticles) {
    check(!slugs.has(article.slug), `Duplicate slug: ${article.slug}`);
    slugs.add(article.slug);

    if (article.heroImage) check(existsSync(join(process.cwd(), "public", article.heroImage.src.slice(1))), `Missing hero image for ${article.slug}`);
    check(article.title.length > 5, `Article ${article.slug} has title too short`);
    check(article.summary.length > 20, `Article ${article.slug} has summary too short`);
    check(article.quickSteps.length >= 3, `Article ${article.slug} must have >= 3 quick steps`);
    check(article.keywords.length >= 3, `Article ${article.slug} must have >= 3 keywords`);
    check(article.sections.length >= 1, `Article ${article.slug} must have >= 1 section`);
    check(article.readTimeMinutes > 0, `Article ${article.slug} invalid readTimeMinutes`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(article.lastUpdated), `Article ${article.slug} invalid date`);

    for (const related of article.relatedArticleSlugs) {
      const found = getArticleBySlug(related);
      check(Boolean(found), `Related slug "${related}" in "${article.slug}" must exist in catalog`);
    }
  }
  console.log("✓ All 16 articles passed schema, relationship, and metadata verification.");

  // 2. Audience & Categories
  console.log("\n2. Validating Categories and Audience Filtering...");
  const ownerGuides = getArticlesByAudience("owner");
  check(ownerGuides.length === 10, "Expected 10 owner guides");
  const customerGuides = getArticlesByAudience("customer");
  check(customerGuides.length === 6, "Expected 6 customer guides");

  const ownerCats = getCategories("owner");
  check(ownerCats.includes("Menu Creation"), "Must include Menu Creation");
  check(ownerCats.includes("Table Setup"), "Must include Table Setup");
  check(ownerCats.includes("Kitchen Operations"), "Must include Kitchen Operations");
  console.log("✓ Categories and audience partitioning verified.");

  // 3. Search Engine
  console.log("\n3. Validating In-App Search Engine...");
  const qrResults = searchHelpArticles("qr code");
  check(qrResults.length > 0, "Query 'qr code' should return results");
  check(
    qrResults.some((r) => r.article.slug === "qr-codes-and-tables"),
    "Expected qr-codes-and-tables"
  );

  check(searchHelpArticles("How do I print a table QR code?")[0]?.article.slug === "qr-codes-and-tables", "Natural language QR question should rank printing first");

  const kitchenResults = searchHelpArticles("kitchen");
  check(kitchenResults.length > 0, "Query 'kitchen' should return results");
  check(
    kitchenResults.some((r) => r.article.slug === "kitchen-display-system"),
    "Expected kitchen-display-system"
  );

  const faqResults = searchFaqs("pricing");
  check(faqResults.length > 0, "FAQ query 'pricing' should return results");
  console.log("✓ Search engine successfully indexes and matches articles and FAQs.");

  // 4. Ember AI Tool & Routing
  console.log("\n4. Validating Ember AI Knowledge Base Integration...");
  const tools = toolDefinitions();
  const helpTool = tools.find((t) => t.name === "help.search");
  check(Boolean(helpTool), "Ember must have 'help.search' tool registered");

  const selectedTools = selectQuestionTools(tools, "How do I print table QR codes?");
  check(
    selectedTools[0]?.name === "help.search",
    "Ember must prioritize help.search for how-to questions"
  );

  const selected86 = selectQuestionTools(tools, "How can I mark a dish as sold out?");
  check(
    selected86[0]?.name === "help.search",
    "Ember must prioritize help.search for 86 board how-to"
  );

  // Test grounded answer formatting
  const mockHelpEvidence = [
    {
      tool: "help.search",
      source: "help.knowledgeBase",
      capturedAt: new Date().toISOString(),
      data: {
        query: "table qr",
        matches: [
          {
            title: "QR Studio & Tabletop Press: Printing Permanent QR Codes",
            slug: "qr-codes-and-tables",
            audience: "owner" as const,
            category: "Table Setup",
            summary:
              "MenuMinute's QR Studio lets you create table-specific or whole-restaurant QR codes.",
            quickSteps: [
              "Open 'QR Codes' from your dashboard sidebar.",
              "Select your QR type: Table-Specific or General Entrance.",
              "Pick your brand theme.",
              "Download print sheet.",
            ],
            dashboardLink: {
              label: "Open QR Studio",
              href: "/dashboard/qr-codes",
            },
          },
        ],
      },
    },
  ];

  const answer = groundedMerchantAnswer("How do I print table QR codes?", mockHelpEvidence);
  check(answer !== null, "Grounded answer must be generated");
  check(answer.includes("QR Studio & Tabletop Press"), "Must mention title");
  check(answer.includes("[Open QR Studio](/dashboard/qr-codes)"), "Must link to dashboard");
  check(answer.includes("/help/owner/qr-codes-and-tables"), "Must link to guide");
  console.log("✓ Ember AI grounded how-to answers and direct dashboard links verified.");

  // 5. Sitemap & Robots SEO
  console.log("\n5. Validating Sitemap and Robots SEO...");
  const sitemapEntries = sitemap();
  check(sitemapEntries.length >= 26, `Expected >= 26 sitemap URLs, got ${sitemapEntries.length}`);
  check(
    sitemapEntries.some((e) => e.url === "https://food.bababuilds.com/help"),
    "Must include /help in sitemap"
  );
  check(
    sitemapEntries.some((e) => e.url === "https://food.bababuilds.com/help/owner/menu-studio"),
    "Must include owner guide in sitemap"
  );
  check(
    sitemapEntries.some(
      (e) => e.url === "https://food.bababuilds.com/help/customer/how-to-scan-qr"
    ),
    "Must include customer guide in sitemap"
  );

  const robotRules = robots();
  check(Boolean(robotRules.rules), "Robots rules must exist");
  check(
    robotRules.sitemap === "https://food.bababuilds.com/sitemap.xml",
    "Robots must declare sitemap URL"
  );
  console.log("✓ Dynamic sitemap.xml and robots.txt rules verified.");

  console.log("\n🎉 ALL 5 VALIDATION SUITES PASSED PERFECTLY!\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
