"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

type Operation = {
  id: string;
  action: string;
  actorName: string;
  createdAt: string;
};

type ActivityPage = {
  items: Operation[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const operationLabels: Record<string, string> = {
  "organization.rename": "Organization renamed",
  "organization.active": "Organization status changed",
  "organization.create": "Organization created",
  "owner.transfer": "Ownership transferred",
  "member.save": "Team member updated",
  "member.invite": "Team member invited",
  "outlet.create": "Outlet created",
  "outlet.update": "Outlet details updated",
  "outlet.roles": "Outlet permissions updated",
  "brand.create": "Brand created",
  "brand.link": "Brand assignment updated",
};

export function describeOrganizationAction(action: string): string {
  const normalized = action.trim().toLowerCase();
  if (operationLabels[normalized]) return operationLabels[normalized];
  const readable = action
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : "Organization updated";
}

export function formatOperationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function OperationsHistory({
  organizationId,
  revision,
}: {
  organizationId: string;
  revision: number;
}) {
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  // The requested key determines loading during render; no synchronous state updates in effects.
  // Stale responses cannot display the previous page or a different organization's audit entries.
  const requestKey = JSON.stringify([organizationId, page, revision, reload]);
  const [result, setResult] = useState<{
    key: string;
    data: ActivityPage | null;
    error: string;
  } | null>(null);
  const loading = result?.key !== requestKey;
  const data = loading ? null : (result?.data ?? null);
  const error = loading ? "" : (result?.error ?? "");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/organizations/${encodeURIComponent(organizationId)}/activity?page=${page}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message || "Operations history is unavailable.");
        }
        return (await response.json()) as ActivityPage;
      })
      .then((pageData) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data: pageData, error: "" });
        if (pageData.page !== page) setPage(pageData.page);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          key: requestKey,
          data: null,
          error: cause instanceof Error ? cause.message : "Unable to load operations history.",
        });
      });
    return () => controller.abort();
  }, [organizationId, page, requestKey]);

  const start = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const end = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <div className="oh-operations">
      <div className="oh-operations-toolbar">
        <p>Recorded changes to your organization, newest first.</p>
        <button
          type="button"
          className="oh-operations-refresh"
          aria-label="Refresh operations history"
          onClick={() => setReload((current) => current + 1)}
          disabled={loading}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh
        </button>
      </div>
      {error ? (
        <div className="oh-operations-empty" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReload((current) => current + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="oh-operations-table-wrap" aria-busy={loading}>
          <table className="oh-operations-table">
            <caption className="sr-only">
              Organization operations history, five entries per page
            </caption>
            <thead>
              <tr>
                <th scope="col">Operation</th>
                <th scope="col">Performed by</th>
                <th scope="col">Date & time</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((event) => (
                <tr key={event.id}>
                  <td className="oh-operations-name">{describeOrganizationAction(event.action)}</td>
                  <td className="oh-operations-actor">{event.actorName}</td>
                  <td className="oh-operations-date">
                    <time dateTime={event.createdAt}>{formatOperationDate(event.createdAt)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
            <p className="oh-operations-empty" role="status">
              Loading operations…
            </p>
          ) : !data?.items.length ? (
            <p className="oh-operations-empty">No organization operations recorded yet.</p>
          ) : null}
        </div>
      )}
      <div className="oh-operations-footer">
        <span role="status" aria-live="polite">
          {data && !error ? `Showing ${start}–${end} of ${data.total}` : "Operations history"}
        </span>
        <div className="oh-operations-pages" aria-label="Operations history pagination">
          <button
            type="button"
            aria-label="Previous operations page"
            disabled={loading || Boolean(error) || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span>
            Page {data?.page ?? page} of {data?.totalPages ?? 1}
          </span>
          <button
            type="button"
            aria-label="Next operations page"
            disabled={loading || Boolean(error) || !data || page >= data.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
