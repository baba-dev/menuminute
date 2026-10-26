# Culinary profiles: trust model and release verification

## Scope

Dish culinary profiles offer *editable reference suggestions*, never factual assertions about an individual restaurant. MenuMinute must not infer ingredients, dietary categories, cross-contact practices, or calorie counts from a dish name. This policy applies to imported, legacy, versioned, public and preview menus.

## Canonical contracts

- Culinary metadata (spice, flavor notes, chef notes, temperature and up to four selected dish IDs) remains an optional part of each versioned dish.
- Nutrition facts require `nutrition.verified === true` before displaying in public dining. Editing the nutritional values in Studio revokes that confirmation.
- Ingredients/allergen declarations require `safety.verified === true`. Changing any ingredient, allergen or cross-contact field revokes that confirmation and all free-from claims.
- Free-from declarations additionally require explicit `safety.verifiedFreeFrom` entries, reviewed ingredients, absence of conflicting declared allergens and absence of cross-contact warnings. Unknown **never** means allergen-free.
- Until allergens are modeled per variant and per add-on, dishes with any variants or add-on groups cannot qualify for the nut-free or dairy-free filter, even if a parent recipe is verified.
- Existing dishes without culinary, nutrition or safety fields remain valid. They are not retroactively enriched.
- Static culinary examples contain no fabricated restaurant kitchen-specific cross-contact assertions. Operator-approved catalogue suggestions are stored as unverified data.
- Guest cart prices and availability remain subject to the checkout server's authoritative validation.

## Operator procedure

1. Inspect the actual recipe, portion sizes, ingredients, supplier labels and kitchen cross-contact.
2. Optionally start from a curated example, then edit the recipe to match actual preparation.
3. Confirm the nutrition information *only after* checking serving size and recipe.
4. Confirm allergens only after inspecting ingredients and shared equipment. If unsafe or unknown, do not assert a free-from status.
5. Select compatible, published and available companion dishes; verify their options and prices independently.
6. Save and preview. Publish through the existing revisioned release path and exercise mobile/desktop public dining.

## Regression and release gates

- Contract unit tests: strict schema, nutrition/verification, unknown vs verified, contradictory claims, customizations and pairing availability.
- Browser tests: unknown allergen filters must return no false positives, unverified guest warning, responsive customization and accessible dismissal.
- Existing CI: pinned Prettier, ESLint, TypeScript, integration DB/Redis, security scanning, ARM64 build and Playwright. Do not bypass any gate or rely on an earlier commit's pass.
- Review changes against latest `main`; migrations and release gates remain unchanged by this feature.

## Future extension

Design variant/add-on-level ingredient and allergen evidence, immutable operator verification audit metadata, nutrition source/provenance and fully localized culinary UI text before advertising these features as jurisdiction-wide compliance tooling.
