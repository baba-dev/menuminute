/**
 * AI Service Interfaces — Phase 0 Scaffolds
 *
 * These are SAFE SCAFFOLDS. No billable AI requests are made.
 * Actual implementations will be added in Phase B.
 *
 * AI failures must never prevent the normal menu system from operating.
 */

export type MenuImportResult = {
  categories: Array<{
    name: string;
    items: Array<{ name: string; price?: number; description?: string }>;
  }>;
};

export type DescriptionEnhanceResult = {
  enhanced: string;
  original: string;
};

export type TranslateMenuResult = {
  language: string;
  translations: Record<string, string>;
};

export type DishImageResult = {
  url: string;
  attribution: string;
  source: "pexels" | "ai_generated" | "library";
};

/**
 * Import a menu from a photograph or PDF.
 * Phase B implementation: Gemini Vision OCR.
 */
export async function importMenuFromImage(
  _imageUrl: string,
  _restaurantId: string
): Promise<MenuImportResult | null> {
  // TODO Phase B: Implement with Gemini Vision API
  console.warn("[AI] importMenuFromImage not yet implemented — Phase B");
  return null;
}

/**
 * Enhance a menu item description using AI.
 * Phase B implementation: Gemini Pro.
 */
export async function enhanceMenuDescription(
  _name: string,
  _currentDescription: string,
  _restaurantId: string
): Promise<DescriptionEnhanceResult | null> {
  // TODO Phase B: Implement with Gemini API
  console.warn("[AI] enhanceMenuDescription not yet implemented — Phase B");
  return null;
}

/**
 * Translate menu content to a target language.
 * Phase B implementation: Gemini Pro.
 */
export async function translateMenu(
  _content: Record<string, string>,
  _targetLanguage: string,
  _restaurantId: string
): Promise<TranslateMenuResult | null> {
  // TODO Phase B: Implement with Gemini API
  console.warn("[AI] translateMenu not yet implemented — Phase B");
  return null;
}

/**
 * Find a licensed stock photograph for a dish.
 * Phase B implementation: Pexels API.
 */
export async function findDishImage(
  _dishName: string,
  _restaurantId: string
): Promise<DishImageResult | null> {
  // TODO Phase B: Implement with Pexels API
  console.warn("[AI] findDishImage not yet implemented — Phase B");
  return null;
}

/**
 * Generate an illustrative image for a dish.
 * Phase B implementation: NVIDIA NIM / Cloudflare Workers AI.
 */
export async function generateDishIllustration(
  _dishName: string,
  _description: string,
  _restaurantId: string
): Promise<DishImageResult | null> {
  // TODO Phase B: Implement with NVIDIA NIM
  console.warn("[AI] generateDishIllustration not yet implemented — Phase B");
  return null;
}
