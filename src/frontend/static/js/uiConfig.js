/**
 * @module uiConfig
 * @description Reads UI configuration injected by the backend into the
 * body's data attributes (the values originate in config/.env and flow
 * through src/config.py and the page template). This module is the only
 * place that reads those attributes.
 */

/**
 * Maximum number of genome rows rendered in the population list.
 *
 * @returns {number} The configured render cap.
 */
export function genomeRenderCap() {
  return Number(document.body.dataset.genomeRenderCap);
}

/**
 * Minimum number of cities required before the solvers can run.
 *
 * @returns {number} The configured minimum city count.
 */
export function minCities() {
  return Number(document.body.dataset.minCities);
}
