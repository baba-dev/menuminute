"use client";

import React, { useState } from "react";
import {
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import type { DiningSection, TableShape } from "@/modules/hospitality/floor-contracts";

interface DiningFloorHudProps {
  sections: DiningSection[];
  activeSection: string;
  onSelectSection: (section: string) => void;
  onAddTable: (template: {
    shape: TableShape;
    capacity: number;
    width: number;
    height: number;
    label?: string;
  }) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  hapticsEnabled: boolean;
  onToggleHaptics: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  selectedHour: string; // "now" | "18:00" | "19:00" ...
  onSelectHour: (hour: string) => void;
}

export function DiningFloorHud({
  sections,
  activeSection,
  onSelectSection,
  onAddTable,
  snapEnabled,
  onToggleSnap,
  hapticsEnabled,
  onToggleHaptics,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  selectedHour,
  onSelectHour,
}: DiningFloorHudProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const hours = ["now", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

  return (
    <aside className="mm-floor-hud" aria-label="Floor plan controls">
      {/* 1. Dining Sections Pill Bar */}
      <nav className="mm-hud-sections" aria-label="Filter by dining section">
        <button
          type="button"
          className={`mm-hud-pill ${activeSection === "all" ? "is-active" : ""}`}
          onClick={() => onSelectSection("all")}
        >
          All Sections
        </button>
        {sections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            className={`mm-hud-pill ${activeSection === sec.name ? "is-active" : ""}`}
            onClick={() => onSelectSection(sec.name)}
          >
            <span
              className="mm-hud-pill-dot"
              style={{ backgroundColor: sec.color }}
              aria-hidden="true"
            />
            {sec.name}
          </button>
        ))}
      </nav>

      {/* 2. Floating Dock: Add Table, Canvas Controls, Zoom, Timeline */}
      <div className="mm-hud-dock" role="toolbar" aria-label="Dining room tools">
        {/* Add Table Button & Dropdown */}
        <div className="mm-hud-popover-wrap">
          <button
            type="button"
            className="mm-hud-btn mm-hud-btn-primary"
            onClick={() => setAddMenuOpen((prev) => !prev)}
            aria-expanded={addMenuOpen}
            aria-label="Add a table to the floor plan"
          >
            <Plus size={15} aria-hidden="true" />
            <span>Add Table</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>

          {addMenuOpen && (
            <div className="mm-hud-menu" role="menu">
              <span className="mm-hud-menu-title">Select Table Template</span>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddTable({
                    shape: "round",
                    capacity: 2,
                    width: 85,
                    height: 85,
                    label: "2-Top Round",
                  });
                  setAddMenuOpen(false);
                }}
              >
                <span className="mm-template-icon mm-icon-round" />
                <div>
                  <strong>Round (2-Top)</strong>
                  <small>Compact bistro table</small>
                </div>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddTable({
                    shape: "round",
                    capacity: 4,
                    width: 105,
                    height: 105,
                    label: "4-Top Round",
                  });
                  setAddMenuOpen(false);
                }}
              >
                <span className="mm-template-icon mm-icon-round" />
                <div>
                  <strong>Round (4-Top)</strong>
                  <small>Standard dining circle</small>
                </div>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddTable({
                    shape: "square",
                    capacity: 4,
                    width: 100,
                    height: 100,
                    label: "4-Top Square",
                  });
                  setAddMenuOpen(false);
                }}
              >
                <span className="mm-template-icon mm-icon-square" />
                <div>
                  <strong>Square (4-Top)</strong>
                  <small>Flexible symmetrical table</small>
                </div>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddTable({
                    shape: "rectangle",
                    capacity: 6,
                    width: 170,
                    height: 95,
                    label: "6-Top Dining",
                  });
                  setAddMenuOpen(false);
                }}
              >
                <span className="mm-template-icon mm-icon-rect" />
                <div>
                  <strong>Rectangle (6-Top)</strong>
                  <small>Family & group dining</small>
                </div>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddTable({
                    shape: "booth",
                    capacity: 6,
                    width: 170,
                    height: 110,
                    label: "6-Top Booth",
                  });
                  setAddMenuOpen(false);
                }}
              >
                <span className="mm-template-icon mm-icon-booth" />
                <div>
                  <strong>Banquette Booth (6-Top)</strong>
                  <small>Upholstered wall booth</small>
                </div>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddTable({
                    shape: "bar",
                    capacity: 4,
                    width: 240,
                    height: 65,
                    label: "Bar Counter",
                  });
                  setAddMenuOpen(false);
                }}
              >
                <span className="mm-template-icon mm-icon-bar" />
                <div>
                  <strong>Bar Counter (4 Stools)</strong>
                  <small>High counter seating</small>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="mm-hud-divider" aria-hidden="true" />

        {/* Snap Grid Toggle */}
        <button
          type="button"
          className={`mm-hud-icon-btn ${snapEnabled ? "is-active" : ""}`}
          onClick={onToggleSnap}
          title={snapEnabled ? "Grid Snap: ON (20px)" : "Grid Snap: OFF"}
          aria-label={snapEnabled ? "Disable magnetic grid snap" : "Enable magnetic grid snap"}
        >
          <Grid size={15} aria-hidden="true" />
        </button>

        {/* Haptics Toggle */}
        <button
          type="button"
          className={`mm-hud-icon-btn ${hapticsEnabled ? "is-active" : ""}`}
          onClick={onToggleHaptics}
          title={hapticsEnabled ? "Tactile Haptics: ON" : "Tactile Haptics: OFF"}
          aria-label={hapticsEnabled ? "Disable tactile haptics" : "Enable tactile haptics"}
        >
          {hapticsEnabled ? (
            <Volume2 size={15} aria-hidden="true" />
          ) : (
            <VolumeX size={15} aria-hidden="true" />
          )}
        </button>

        <div className="mm-hud-divider" aria-hidden="true" />

        {/* Zoom Controls */}
        <button
          type="button"
          className="mm-hud-icon-btn"
          onClick={onZoomOut}
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <ZoomOut size={15} aria-hidden="true" />
        </button>
        <span className="mm-hud-zoom-badge">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="mm-hud-icon-btn"
          onClick={onZoomIn}
          title="Zoom In"
          aria-label="Zoom in"
        >
          <ZoomIn size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="mm-hud-icon-btn"
          onClick={onResetZoom}
          title="Reset View"
          aria-label="Fit floor plan to screen"
        >
          <Maximize2 size={14} aria-hidden="true" />
        </button>

        <div className="mm-hud-divider" aria-hidden="true" />

        {/* Time Scrubber / Timeline Dropdown */}
        <div className="mm-hud-popover-wrap">
          <button
            type="button"
            className={`mm-hud-btn ${selectedHour !== "now" ? "mm-hud-btn-active" : ""}`}
            onClick={() => setTimeOpen((prev) => !prev)}
            aria-expanded={timeOpen}
            aria-label="Select timeline view hour"
          >
            <Clock size={14} aria-hidden="true" />
            <span>{selectedHour === "now" ? "Live Now" : selectedHour}</span>
            <ChevronDown size={11} aria-hidden="true" />
          </button>

          {timeOpen && (
            <div className="mm-hud-menu mm-hud-time-menu" role="menu">
              <span className="mm-hud-menu-title">Preview Occupancy Time</span>
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={selectedHour === h ? "is-selected" : ""}
                  onClick={() => {
                    onSelectHour(h);
                    setTimeOpen(false);
                  }}
                >
                  {h === "now" ? (
                    <>
                      <Sparkles size={13} className="text-amber-500" /> Live (Current Tickets)
                    </>
                  ) : (
                    <span>{h} Bookings</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
