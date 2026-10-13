/**
 * Media Service — Phase 0 Scaffold
 *
 * Local filesystem storage for development.
 * R2 adapter will be added in Phase B.
 *
 * Image resolution priority:
 * 1. Restaurant-uploaded photograph
 * 2. Approved reusable dish-image library
 * 3. Licensed Pexels stock-photo suggestion
 * 4. Optional AI-generated illustrative image
 * 5. Locally available category SVG fallback
 */
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

export type UploadResult = {
  publicUrl: string;
  storageKey: string;
  storageProvider: "local" | "r2";
  width?: number;
  height?: number;
  sizeBytes?: number;
  mimeType: string;
};

export type MediaAssetResolution = {
  url: string;
  source: "restaurant_upload" | "library" | "pexels" | "ai" | "fallback_svg";
  attribution?: string;
};

/**
 * Upload a media file to local storage (development) or R2 (production).
 */
export async function uploadMedia(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  restaurantId: string
): Promise<UploadResult> {
  // Local storage for Phase 0
  const uploadDir = path.join(process.cwd(), "public", "uploads", restaurantId);
  await fs.mkdir(uploadDir, { recursive: true });

  const ext = path.extname(filename) || ".jpg";
  const storageKey = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(uploadDir, storageKey);

  // Process image with sharp for optimization
  let processedBuffer = fileBuffer;
  let width: number | undefined;
  let height: number | undefined;

  if (mimeType.startsWith("image/")) {
    const sharpInstance = sharp(fileBuffer);
    const metadata = await sharpInstance.metadata();
    width = metadata.width;
    height = metadata.height;

    // Resize if too large (max 2000px on longest side)
    if ((width ?? 0) > 2000 || (height ?? 0) > 2000) {
      processedBuffer = await sharpInstance
        .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    }
  }

  await fs.writeFile(filePath, processedBuffer);

  return {
    publicUrl: `/uploads/${restaurantId}/${storageKey}`,
    storageKey: `uploads/${restaurantId}/${storageKey}`,
    storageProvider: "local",
    width,
    height,
    sizeBytes: processedBuffer.length,
    mimeType,
  };
}

/**
 * Resolve a media asset URL following the priority chain.
 * Always returns a usable URL — falls back to SVG if needed.
 */
export function resolveMediaAsset(
  restaurantUploadUrl: string | null | undefined,
  categoryName?: string
): MediaAssetResolution {
  // Priority 1: Restaurant-uploaded photograph
  if (restaurantUploadUrl) {
    return { url: restaurantUploadUrl, source: "restaurant_upload" };
  }

  // Priority 2-4: Not yet implemented (Phase B)

  // Priority 5: Category SVG fallback
  const fallbackSvg = getCategoryFallbackSvg(categoryName);
  return { url: fallbackSvg, source: "fallback_svg" };
}

/**
 * Get a category-appropriate SVG illustration URL.
 */
function getCategoryFallbackSvg(categoryName?: string): string {
  const name = categoryName?.toLowerCase() ?? "";

  if (name.includes("drink") || name.includes("beverage")) {
    return "/icons/category-beverages.svg";
  }
  if (name.includes("dessert") || name.includes("sweet")) {
    return "/icons/category-desserts.svg";
  }
  if (name.includes("bread") || name.includes("roti") || name.includes("naan")) {
    return "/icons/category-breads.svg";
  }
  if (name.includes("rice") || name.includes("biryani")) {
    return "/icons/category-rice.svg";
  }
  if (name.includes("starter") || name.includes("appetizer") || name.includes("soup")) {
    return "/icons/category-starters.svg";
  }

  return "/icons/category-default.svg";
}
