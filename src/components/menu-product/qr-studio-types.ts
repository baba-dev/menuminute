export type QR = {
  id: string;
  label: string | null;
  destinationToken: string;
  isActive: boolean;
  tableId: string | null;
};

export type QRFilter = "active" | "revoked" | "all";
export type PrintFormat = "stand" | "sticker" | "insert";

export function qrStatistics(codes: QR[]) {
  return {
    active: codes.filter((q) => q.isActive).length,
    servicePoints: codes.filter((q) => q.isActive && q.tableId !== null).length,
    revoked: codes.filter((q) => !q.isActive).length,
    total: codes.length,
  };
}

export function filterQrCodes(codes: QR[], query: string, filter: QRFilter) {
  const needle = query.trim().toLocaleLowerCase();
  return codes.filter(
    (q) =>
      (filter === "all" || (filter === "active" ? q.isActive : !q.isActive)) &&
      (!needle ||
        (q.label ?? "Menu QR").toLocaleLowerCase().includes(needle) ||
        (q.tableId && "service point".includes(needle)))
  );
}

export function qrDestination(origin: string, token: string) {
  return new URL("/m/" + encodeURIComponent(token), origin).toString();
}
