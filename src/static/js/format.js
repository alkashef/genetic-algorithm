/**
 * @module format
 * @description Display formatting helpers shared by the solver views.
 */

/**
 * Format a normalized-space distance for display in the ×1000 integer
 * units used by every stat card and chart tick.
 *
 * @param {number} dist - Distance in normalized [0,1] canvas space.
 * @returns {string} Locale-formatted integer string.
 */
export function formatDistance(dist) {
  return Math.round(dist * 1000).toLocaleString();
}

/**
 * Format a route as an arrow-joined sequence of city indices for display.
 *
 * @param {number[]} route - City indices, e.g. [0, 2, 1, 0].
 * @returns {string} Arrow-joined sequence, e.g. "0 → 2 → 1 → 0".
 */
export function formatRoute(route) {
  return route.join(" → ");
}
