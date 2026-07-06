/**
 * @module events
 * @description Typed wrappers around the document-level CustomEvent bus.
 * All cross-module communication goes through these functions so event
 * names and payload shapes live in exactly one place.
 */

/**
 * Announce that the city set changed (added, randomized, or cleared).
 * Views listening via onCitiesChanged() should reset and redraw.
 *
 * @returns {void}
 */
export function emitCitiesChanged() {
  document.dispatchEvent(new CustomEvent("cities:changed"));
}

/**
 * Subscribe to city-set changes.
 *
 * @param {() => void} handler - Called after every city-set change.
 * @returns {void}
 */
export function onCitiesChanged(handler) {
  document.addEventListener("cities:changed", handler);
}

/**
 * Announce that the brute-force solver started or stopped running.
 *
 * @param {boolean} running - True while the solver is running.
 * @returns {void}
 */
export function emitBruteForceRunning(running) {
  document.dispatchEvent(new CustomEvent("bruteforce:running", { detail: { running } }));
}

/**
 * Subscribe to brute-force run-state changes.
 *
 * @param {(running: boolean) => void} handler - Receives the run state.
 * @returns {void}
 */
export function onBruteForceRunning(handler) {
  document.addEventListener("bruteforce:running", (event) => handler(event.detail.running));
}
