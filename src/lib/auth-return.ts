/** Only same-origin page paths may be used as authentication return destinations. */
export function safeReturnPath(candidate: string | null | undefined, fallback = "/dashboard") {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(candidate) ||
    /%(?:2f|5c|0[0-9a-f]|1[0-9a-f])/i.test(candidate)
  )
    return fallback;
  try {
    const parsed = new URL(candidate, "https://menuminute.example");
    if (
      parsed.origin !== "https://menuminute.example" ||
      parsed.pathname.startsWith("/api/") ||
      parsed.pathname === "/login" ||
      parsed.pathname === "/register" ||
      parsed.pathname.startsWith("/reset-password")
    )
      return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
export const authNextKey = "menuminute.auth.return";
