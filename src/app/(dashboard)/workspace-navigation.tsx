"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Sparkles } from "lucide-react";
import type { DashboardNavigation } from "@/modules/menu-product/dashboard-data";
import {
  addOnHint,
  groupNavigation,
  isNavSelected,
  type ResolvedNavItem,
} from "@/modules/dashboard/nav-model";
import { WorkspaceIcon } from "./workspace-icons";

function NavLink({ item }: { item: ResolvedNavItem }) {
  const pathname = usePathname();
  const selected = isNavSelected(item, pathname);
  if (item.nav.state === "unavailable") {
    // Only "unknown" lands here; known-unavailable items live under Add-ons.
    return (
      <span className="mm-workspace-nav-link is-unavailable" aria-disabled="true">
        <WorkspaceIcon name={item.icon} strokeWidth={1.9} />
        <span>{item.nav.label}</span>
        <small>Availability unknown</small>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      className={"mm-workspace-nav-link" + (selected ? " is-active" : "")}
      aria-current={selected ? "page" : undefined}
    >
      <WorkspaceIcon name={item.icon} strokeWidth={1.9} />
      <span>{item.nav.label}</span>
    </Link>
  );
}

/**
 * Grouped sidebar: Run service, Menu, Insights, Admin. Destinations the plan or role does not
 * include collapse into an "Add-ons" disclosure with a plain hint instead of a row of dead links.
 */
export function WorkspaceNavigation({ capabilities }: { capabilities?: DashboardNavigation }) {
  const grouped = groupNavigation(capabilities);
  const [addOnsOpen, setAddOnsOpen] = useState(false);
  const addOnsList = useRef<HTMLUListElement>(null);
  // The sidebar scrolls internally; bring a freshly opened list fully into view.
  useEffect(() => {
    if (addOnsOpen) addOnsList.current?.scrollIntoView?.({ block: "nearest" });
  }, [addOnsOpen]);

  return (
    <nav className="mm-workspace-nav" aria-label="Workspace">
      <div className="mm-workspace-nav-items">
        <NavLink item={grouped.overview} />
      </div>
      {grouped.groups.map((group) => (
        <div
          className="mm-workspace-nav-group"
          key={group.id}
          role="group"
          aria-label={group.label}
        >
          <span className="mm-workspace-nav-label" aria-hidden="true">
            {group.label}
          </span>
          <div className="mm-workspace-nav-items">
            {group.items.map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
      {grouped.addOns.length > 0 && (
        <div className="mm-workspace-nav-group mm-workspace-addons">
          <button
            type="button"
            className="mm-workspace-addons-toggle"
            aria-expanded={addOnsOpen}
            aria-controls="mm-workspace-addons-list"
            onClick={() => setAddOnsOpen((open) => !open)}
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>Add-ons</span>
            <small>{grouped.addOns.length}</small>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={"mm-workspace-addons-chevron" + (addOnsOpen ? " is-open" : "")}
            />
          </button>
          {addOnsOpen && (
            <ul ref={addOnsList} id="mm-workspace-addons-list" className="mm-workspace-addons-list">
              {grouped.addOns.map((item) => (
                <li key={item.id}>
                  <span className="mm-workspace-addon-name">
                    <WorkspaceIcon name={item.icon} size={16} />
                    {item.nav.label}
                  </span>
                  <small>{addOnHint(item)}</small>
                  {item.nav.state === "unavailable" && item.nav.reason === "not-enabled" && (
                    <Link href="/pricing" className="mm-workspace-addon-link">
                      See plans
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </nav>
  );
}
