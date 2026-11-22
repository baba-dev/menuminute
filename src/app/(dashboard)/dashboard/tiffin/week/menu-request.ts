export type MenuPutBody =
  | { kind: "slot"; slot: unknown }
  | { kind: "week"; week: unknown }
  | { kind: "override"; override: unknown }
  | { kind: "overrideClear"; override: unknown };

export type MenuPutResult =
  { ok: true; data: Record<string, unknown> } | { ok: false; message: string };

/** PUT /api/tiffin/[outletId]/menu. Server messages are returned verbatim for inline display. */
export async function putMenu(outletId: string, body: MenuPutBody): Promise<MenuPutResult> {
  try {
    const response = await fetch(`/api/tiffin/${encodeURIComponent(outletId)}/menu`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      return {
        ok: false,
        message:
          typeof data?.["message"] === "string"
            ? data["message"]
            : "Something went wrong. Nothing was changed.",
      };
    }
    return { ok: true, data: data ?? {} };
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check your connection and try again.",
    };
  }
}
