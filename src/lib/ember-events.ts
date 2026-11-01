/**
 * The command palette asks the Ember launcher to open with a question pre-filled. It is an
 * in-page event so the two components stay decoupled. The launcher only fills the input:
 * nothing is sent to a model until the person presses Send.
 */
export const EMBER_ASK_EVENT = "mm:ember-ask";

export function askEmber(prompt: string) {
  window.dispatchEvent(new CustomEvent(EMBER_ASK_EVENT, { detail: { prompt } }));
}

/** The workspace shell announces transient pop-ups; the Ember pop-up stack renders them. */
export const EMBER_POPUP_EVENT = "mm:ember-popup";
