"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { RotateCw, Plus, Minus, Trash2, SlidersHorizontal, Copy } from "lucide-react";
import type {
  VisualTable,
  FloorLayoutDoc,
  TableLiveStatus,
} from "@/modules/hospitality/floor-contracts";
import { TableGlyph } from "./svg-table-glyphs";
import { useHaptics } from "@/lib/use-haptics";

interface DiningFloorCanvasProps {
  layout: FloorLayoutDoc;
  onChangeLayout: (next: FloorLayoutDoc) => void;
  selectedTableId: string | null;
  onSelectTable: (table: VisualTable | null) => void;
  tableStatuses: Record<string, TableLiveStatus>;
  snapEnabled: boolean;
  hapticsEnabled: boolean;
  zoom: number;
  onOpenInspector: (table: VisualTable) => void;
  onDuplicateTable: (table: VisualTable) => void;
  onDeleteTable: (table: VisualTable) => void;
  activeSectionFilter: string;
}

export function DiningFloorCanvas({
  layout,
  onChangeLayout,
  selectedTableId,
  onSelectTable,
  tableStatuses,
  snapEnabled,
  hapticsEnabled,
  zoom,
  onOpenInspector,
  onDuplicateTable,
  onDeleteTable,
  activeSectionFilter,
}: DiningFloorCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const haptics = useHaptics(hapticsEnabled);

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Dragging table state
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastSnap = useRef({ x: 0, y: 0 });

  // Hover state
  const [hoveredTable, setHoveredTable] = useState<VisualTable | null>(null);

  const selectedTable = layout.tables.find((t) => t.id === selectedTableId) ?? null;

  // Converts client screen coordinates (clientX, clientY) into SVG virtual canvas coordinates
  const clientToSvgCoords = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const screenCTM = svg.getScreenCTM();
    if (!screenCTM) return { x: clientX, y: clientY };
    const transformed = pt.matrixTransform(screenCTM.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);

  // Handle table drag start
  const handleTablePointerDown = (e: React.PointerEvent<SVGGElement>, table: VisualTable) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);

    haptics.tick();
    onSelectTable(table);
    setDraggingTableId(table.id);

    const svgCoords = clientToSvgCoords(e.clientX, e.clientY);
    dragOffset.current = {
      x: svgCoords.x - table.x,
      y: svgCoords.y - table.y,
    };
    lastSnap.current = { x: table.x, y: table.y };
  };

  // Handle table drag move
  const handleTablePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!draggingTableId) return;

    const svgCoords = clientToSvgCoords(e.clientX, e.clientY);
    let newX = svgCoords.x - dragOffset.current.x;
    let newY = svgCoords.y - dragOffset.current.y;

    const grid = layout.canvas.gridSnap || 20;
    if (snapEnabled) {
      newX = Math.round(newX / grid) * grid;
      newY = Math.round(newY / grid) * grid;
    }

    // Bounds clamping
    newX = Math.max(20, Math.min(newX, layout.canvas.width - 150));
    newY = Math.max(20, Math.min(newY, layout.canvas.height - 150));

    // Tactile snap trigger
    if (newX !== lastSnap.current.x || newY !== lastSnap.current.y) {
      lastSnap.current = { x: newX, y: newY };
      if (snapEnabled) haptics.snap();
    }

    onChangeLayout({
      ...layout,
      tables: layout.tables.map((t) => (t.id === draggingTableId ? { ...t, x: newX, y: newY } : t)),
    });
  };

  // Handle table drag end
  const handleTablePointerUp = (e: React.PointerEvent<SVGGElement>) => {
    if (!draggingTableId) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    setDraggingTableId(null);
    haptics.drop();
  };

  // Handle canvas background pan
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 0) {
      // Middle click or click on canvas background
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    });
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  // Rotate selected table
  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedTable) return;
    haptics.tick();
    const nextRotation = (selectedTable.rotation + 45) % 360;
    onChangeLayout({
      ...layout,
      tables: layout.tables.map((t) =>
        t.id === selectedTable.id ? { ...t, rotation: nextRotation } : t
      ),
    });
  };

  // Adjust chairs
  const handleAdjustChairs = (delta: number) => {
    if (!selectedTable) return;
    haptics.tick();
    const nextCapacity = Math.max(1, Math.min(24, selectedTable.capacity + delta));
    onChangeLayout({
      ...layout,
      tables: layout.tables.map((t) =>
        t.id === selectedTable.id ? { ...t, capacity: nextCapacity } : t
      ),
    });
  };

  // Physical table mutations must be committed through the service.
  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTable) onDuplicateTable(selectedTable);
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTable) onDeleteTable(selectedTable);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTableId) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const step = snapEnabled ? layout.canvas.gridSnap || 20 : 10;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        haptics.tick();
        onChangeLayout({
          ...layout,
          tables: layout.tables.map((t) => {
            if (t.id !== selectedTableId) return t;
            let nx = t.x;
            let ny = t.y;
            if (e.key === "ArrowUp") ny = Math.max(20, ny - step);
            if (e.key === "ArrowDown") ny = Math.min(layout.canvas.height - 100, ny + step);
            if (e.key === "ArrowLeft") nx = Math.max(20, nx - step);
            if (e.key === "ArrowRight") nx = Math.min(layout.canvas.width - 100, nx + step);
            return { ...t, x: nx, y: ny };
          }),
        });
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedTable) {
        e.preventDefault();
        onDeleteTable(selectedTable);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTableId, snapEnabled, layout, onChangeLayout, onSelectTable, onDeleteTable, selectedTable, haptics]);

  const { width: canvasW, height: canvasH } = layout.canvas;

  return (
    <div
      ref={containerRef}
      className="mm-floor-canvas-container"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onClick={() => onSelectTable(null)}
    >
      <div
        className="mm-floor-viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          width={canvasW}
          height={canvasH}
          className="mm-floor-svg"
          aria-label="Restaurant dining floor plan"
        >
          <defs>
            {/* Architectural Grid pattern */}
            <pattern
              id="mm-floor-grid-pattern"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                className="mm-grid-line"
              />
              <circle cx="0" cy="0" r="1.5" className="mm-grid-dot" />
            </pattern>
          </defs>

          {/* Canvas Background & Grid */}
          <rect x="0" y="0" width={canvasW} height={canvasH} className="mm-floor-bg" />
          <rect
            x="0"
            y="0"
            width={canvasW}
            height={canvasH}
            fill="url(#mm-floor-grid-pattern)"
            className="mm-grid-overlay"
          />

          {/* Floor boundary border */}
          <rect
            x="0"
            y="0"
            width={canvasW}
            height={canvasH}
            fill="none"
            className="mm-floor-boundary"
          />

          {/* Tables Layer */}
          {layout.tables.map((table) => {
            const isMatch = activeSectionFilter === "all" || table.section === activeSectionFilter;
            const isSelected = table.id === selectedTableId;
            const isHovered = hoveredTable?.id === table.id;
            const status = tableStatuses[table.id];

            return (
              <g
                key={table.id}
                opacity={isMatch ? 1 : 0.25}
                style={{ transition: "opacity 160ms ease" }}
                onPointerDown={(e) => handleTablePointerDown(e, table)}
                onPointerMove={handleTablePointerMove}
                onPointerUp={handleTablePointerUp}
              >
                <TableGlyph
                  table={table}
                  status={status}
                  selected={isSelected}
                  hovered={isHovered}
                  onSelect={(t) => {
                    onSelectTable(t);
                  }}
                  onHover={(t) => setHoveredTable(t)}
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Quick Handles for Selected Table */}
        {selectedTable && (
          <div
            className="mm-table-quick-toolbar"
            style={{
              left: selectedTable.x + selectedTable.width / 2,
              top: Math.max(10, selectedTable.y - 48),
            }}
            onClick={(e) => e.stopPropagation()}
            role="toolbar"
            aria-label="Table quick actions"
          >
            <button
              type="button"
              onClick={handleRotate}
              title="Rotate 45°"
              aria-label="Rotate table 45 degrees"
            >
              <RotateCw size={13} aria-hidden="true" />
            </button>
            <div className="mm-quick-sep" aria-hidden="true" />
            <button
              type="button"
              onClick={() => handleAdjustChairs(-1)}
              title="Remove chair"
              aria-label="Decrease chair capacity"
              disabled={selectedTable.capacity <= 1}
            >
              <Minus size={13} aria-hidden="true" />
            </button>
            <span className="mm-quick-cap">{selectedTable.capacity}p</span>
            <button
              type="button"
              onClick={() => handleAdjustChairs(1)}
              title="Add chair"
              aria-label="Increase chair capacity"
              disabled={selectedTable.capacity >= 24}
            >
              <Plus size={13} aria-hidden="true" />
            </button>
            <div className="mm-quick-sep" aria-hidden="true" />
            <button
              type="button"
              onClick={handleDuplicate}
              title="Duplicate table"
              aria-label="Duplicate table"
            >
              <Copy size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onOpenInspector(selectedTable)}
              title="Open QR & Table Details"
              aria-label="Open QR and table details drawer"
              className="mm-quick-btn-highlight"
            >
              <SlidersHorizontal size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              title="Delete table"
              aria-label="Delete table"
              className="mm-quick-btn-danger"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
