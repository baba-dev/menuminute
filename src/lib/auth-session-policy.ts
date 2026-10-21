/** Better Auth uses seconds for sliding, database-backed sessions. */
export const REMEMBERED_SESSION_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_REFRESH_SECONDS = 60 * 60 * 24;

/**
 * Reads in React Server Components cannot forward renewed Set-Cookie headers to
 * the browser. A same-origin browser request is required for rolling cookie renewal.
 * Never shorten the session for a transient outage, and never store tokens in JS.
 */
export const SESSION_CONTINUITY_INTERVAL_MS = 4 * 60 * 60 * 1000;
export const SESSION_CONTINUITY_MIN_GAP_MS = 60 * 1000;
