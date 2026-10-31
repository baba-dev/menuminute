/**
 * The command palette asks the Ember launcher to open with a question pre-filled. It is an
 * in-page event so the two components stay decoupled. The launcher only fills the input:
 * nothing is sent to a model until the person presses Send.
 */
export const EMBER_ASK_EVENT = "mm:ember-ask";

export function askEmber(prompt: string) {
  window.dispatchEvent(new CustomEvent(EMBER_ASK_EVENT, { detail: { prompt } }));
}
