import { ValidationError } from "@/lib/errors";
const MAX_BYTES = 6000;
/** Read the body with a real byte ceiling, not Content-Length trust or unbounded req.json(). */
export async function boundedJson(req: Request): Promise<unknown> {
  if (!req.body) throw new ValidationError("Request body required");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BYTES) throw new ValidationError("Assistant request too large");
      chunks.push(next.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) { buffer.set(part, offset); offset += part.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
}
