/** Compare persisted table metadata, not visual coordinates.
 * The caller has already validated that the physical table exists.
 */
export type FloorTableMetadata = {
  tableNumber: string;
  label: string | null;
  capacity: number | null;
};

export function needsTableMetadataUpdate(
  current: FloorTableMetadata,
  next: { tableNumber: string; label: string | null; capacity: number }
): boolean {
  return (
    current.tableNumber !== next.tableNumber ||
    current.label !== next.label ||
    current.capacity !== next.capacity
  );
}
