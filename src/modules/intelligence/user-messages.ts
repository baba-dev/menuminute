/**
 * Plain-language copy for failed Ember turns. Pure and client-safe: it never receives provider
 * payloads, tenant data or secrets, only the stored short failure code. Every message says that
 * nothing was changed in the business, then what the person can do next.
 */
export type FailureCopy = { title: string; next: string };

const COPY: Record<string, FailureCopy> = {
  disabled: {
    title: "Ember is switched off right now.",
    next: "Ask the person who manages your account to turn it on.",
  },
  not_configured: {
    title: "Ember isn't fully set up yet.",
    next: "Please tell your account administrator. You can still use every other page as usual.",
  },
  unsupported_capability: {
    title: "Ember can't do that with its current setup.",
    next: "Try asking in a simpler way, or use the page for this task directly.",
  },
  invalid_request: {
    title: "That question was a bit too long or unclear for Ember.",
    next: "Try a shorter question about one thing, for example: “How many orders today?”",
  },
  authentication: {
    title: "Ember couldn't sign in to its thinking service.",
    next: "Please tell your account administrator; it is not something you did.",
  },
  quota_exhausted: {
    title: "Ember has reached its limit for today.",
    next: "It resets tomorrow. Everything else in the app keeps working.",
  },
  rate_limited: {
    title: "Ember is a little busy right now.",
    next: "Wait a minute and ask again.",
  },
  provider_unavailable: {
    title: "Ember's thinking service isn't responding.",
    next: "This is usually brief. Try again in a few minutes.",
  },
  provider_error: {
    title: "Ember had trouble understanding that request.",
    next: "Try rephrasing your question.",
  },
  invalid_response: {
    title: "Ember couldn't put together a trustworthy answer.",
    next: "Try asking again, or ask about one thing at a time.",
  },
  timeout: {
    title: "Ember took too long to answer.",
    next: "Please try again; a shorter question is usually quicker.",
  },
  cancelled: {
    title: "That question was cancelled.",
    next: "Ask again whenever you're ready.",
  },
  processing_failed: {
    title: "Something went wrong while Ember was working on that.",
    next: "Please try again. If it keeps happening, tell your account administrator.",
  },
};

export function failureCopy(code: string | null | undefined): FailureCopy {
  return (code && COPY[code]) || COPY["processing_failed"]!;
}

export const NO_CHANGE_NOTE = "Nothing in your restaurant was changed.";
