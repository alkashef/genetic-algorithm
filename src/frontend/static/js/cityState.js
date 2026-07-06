/**
 * @module cityState
 * @description Owns the shared city collection and the distance matrix used
 * for rendering. Cities are stored in normalized [0,1] × [0,1] space so the
 * same set draws at correct relative positions on canvases of any size.
 * Solver math lives on the Python backend — this module only supports the
 * frontend's rendering needs.
 */

const cities = [];

/**
 * Get the current city list.
 *
 * @returns {Array<{x: number, y: number}>} The internal city array
 *   (treat as read-only; mutate only via the setters below).
 */
export function getCities() {
  return cities;
}

/**
 * Replace the entire city set.
 *
 * @param {Array<{x: number, y: number}>} newCities - The replacement cities.
 * @returns {void}
 */
export function setCities(newCities) {
  cities.length = 0;
  cities.push(...newCities);
}

/**
 * Remove all cities.
 *
 * @returns {void}
 */
export function clearCities() {
  cities.length = 0;
}

/**
 * Generate random cities in normalized space, keeping a margin from the
 * edges so points are not clipped by the canvas border.
 *
 * @param {number} count - How many cities to generate.
 * @param {number} [margin=0.06] - Border margin in normalized units.
 * @returns {Array<{x: number, y: number}>} The generated cities.
 */
export function randomCities(count, margin = 0.06) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({
      x: margin + Math.random() * (1 - margin * 2),
      y: margin + Math.random() * (1 - margin * 2),
    });
  }
  return result;
}

/**
 * Euclidean distance between two cities in normalized space.
 *
 * @param {{x: number, y: number}} a - First city.
 * @param {{x: number, y: number}} b - Second city.
 * @returns {number} The straight-line distance.
 */
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Build a symmetric pairwise distance matrix for rendering edge labels.
 *
 * @param {Array<{x: number, y: number}>} cityList - Cities to measure.
 * @returns {number[][]} n×n matrix where [i][j] is distance(i, j).
 */
export function buildDistanceMatrix(cityList) {
  const n = cityList.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = distance(cityList[i], cityList[j]);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

/**
 * Number of distinct brute-force routes for a city count (fixed start,
 * mirror routes skipped) — mirrors count_routes() in bruteforce_service.py.
 *
 * @param {number} n - City count.
 * @returns {number} (n-1)!/2 for n > 2, else 1.
 */
export function totalRoutes(n) {
  if (n <= 2) return 1;
  let result = 1;
  for (let i = 2; i <= n - 1; i++) result *= i;
  return result / 2;
}
