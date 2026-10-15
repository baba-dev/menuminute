import { AppError } from "./errors";
export async function boundedBytes(req: Request, max: number) {
  const reader = req.body?.getReader();
  if (!reader) throw new AppError("Request body required", "BODY", 400);
  let size = 0;
  const parts: Buffer[] = [];
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.byteLength;
      if (size > max) throw new AppError("Request exceeds the upload limit", "BODY_LIMIT", 413);
      parts.push(Buffer.from(r.value));
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(parts);
}
export async function boundedJson(req: Request) {
  return JSON.parse((await boundedBytes(req, 600000)).toString("utf8"));
}
