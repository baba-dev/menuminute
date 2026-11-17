/**
 * Browser-side preparation of a menu photograph before private upload.
 *
 * The import API accepts at most 5 MiB and 10 megapixels per photo. A current phone camera
 * produces 12 to 50 megapixels, so an untouched photo was refused outright. A photo over either
 * limit is scaled down here and re-encoded as JPEG; the reader works from a 1600 px copy anyway,
 * so no legible detail is lost. A photo already within the limits is returned untouched.
 */
export const UPLOAD_BYTE_LIMIT = 5 * 1024 * 1024;
/** Leave headroom under the server limits so a prepared photo is never refused. */
const TARGET_BYTES = Math.floor(4.5 * 1024 * 1024);
const TARGET_PIXELS = 9_000_000;
const TARGET_EDGE = 3200;
/** Anything larger is not a phone photo, and decoding it could exhaust a phone's memory. */
const RAW_BYTE_LIMIT = 60 * 1024 * 1024;
const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** A photo that cannot be used, with a sentence that names the file and the remedy. */
export class PhotoError extends Error {}

export type PreparedPhoto = { file: File; resized: boolean };

function describe(file: File) {
  return file.name ? "“" + file.name + "”" : "This photo";
}

export function unsupportedReason(file: File): string | null {
  if (file.size === 0) return describe(file) + " is empty. Take or choose the photo again.";
  if (SUPPORTED.has(file.type)) return null;
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf"))
    return (
      describe(file) +
      " is a PDF, which is not supported yet. Photograph each page or export the pages as images."
    );
  if (/hei[cf]/.test(file.type) || /\.hei[cf]$/.test(name))
    return (
      describe(file) +
      " is in Apple’s HEIC format. Use the camera button here, or set your camera to “Most Compatible” (JPEG)."
    );
  return describe(file) + " is not a photo we can read. Use a JPEG, PNG or WebP image.";
}

function encode(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const refused = unsupportedReason(file);
  if (refused) throw new PhotoError(refused);
  if (file.size > RAW_BYTE_LIMIT)
    throw new PhotoError(
      describe(file) + " is larger than 60 MB. Take the photo with your phone camera instead."
    );
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError(
      describe(file) + " could not be opened. It may be damaged; take or choose the photo again."
    );
  }
  try {
    const pixels = bitmap.width * bitmap.height;
    if (file.size <= TARGET_BYTES && pixels <= TARGET_PIXELS) return { file, resized: false };
    const scale = Math.min(
      1,
      TARGET_EDGE / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(TARGET_PIXELS / pixels)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new PhotoError(
        describe(file) + " is too large for this browser to resize. Choose a smaller photo."
      );
    // JPEG has no transparency; a transparent PNG would otherwise turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.68]) {
      const blob = await encode(canvas, quality);
      if (blob && blob.type === "image/jpeg" && blob.size <= TARGET_BYTES)
        return {
          file: new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
            type: "image/jpeg",
          }),
          resized: true,
        };
    }
    throw new PhotoError(
      describe(file) + " could not be made small enough to upload. Choose a smaller photo."
    );
  } finally {
    bitmap.close();
  }
}
