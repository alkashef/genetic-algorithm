/**
 * @module citySetupView
 * @description Owns the city-setup section: the count input, the
 * Randomize/Clear buttons, the city counter, and the setup canvas showing
 * the complete graph with edge distances. All DOM access for that section
 * lives here. Emits cities:changed after every city-set change.
 */

import { emitCitiesChanged, onBruteForceRunning, onCitiesChanged } from "./events.js";
import { getCities, setCities, clearCities, randomCities, buildDistanceMatrix } from "./cityState.js";
import { clearCanvas, drawCities, drawCompleteGraph } from "./canvasUtils.js";

const refs = {};

/**
 * Wire up the section's controls, seed the initial random city set, and
 * announce it to the other views.
 *
 * @returns {void}
 */
export function initCitySetupView() {
  refs.countInput = document.getElementById("cityCount");
  refs.randomizeBtn = document.getElementById("randomizeBtn");
  refs.clearBtn = document.getElementById("clearBtn");
  refs.counter = document.getElementById("cityCounter");
  refs.canvas = document.getElementById("setupCanvas");
  refs.ctx = refs.canvas.getContext("2d");
  refs.randomizeBtn.addEventListener("click", randomize);
  refs.clearBtn.addEventListener("click", clear);
  onCitiesChanged(redraw);
  onBruteForceRunning(setBusy);
  randomize();
}

/**
 * Replace the current cities with a fresh random set of the requested size.
 *
 * @returns {void}
 */
function randomize() {
  const raw = parseInt(refs.countInput.value, 10) || 0;
  const min = Number(refs.countInput.min);
  const max = Number(refs.countInput.max);
  const count = Math.max(min, Math.min(max, raw));
  setCities(randomCities(count));
  emitCitiesChanged();
}

/**
 * Remove all cities.
 *
 * @returns {void}
 */
function clear() {
  clearCities();
  emitCitiesChanged();
}

/**
 * Redraw the complete graph, city dots, and the counter.
 *
 * @returns {void}
 */
function redraw() {
  const cities = getCities();
  clearCanvas(refs.ctx, refs.canvas);
  const distMatrix = buildDistanceMatrix(cities);
  drawCompleteGraph(refs.ctx, refs.canvas, cities, { showDistances: true, distMatrix });
  drawCities(refs.ctx, refs.canvas, cities);
  refs.counter.textContent = String(cities.length);
}

/**
 * Lock the city controls while a solver run is in flight so the city set
 * cannot change under it.
 *
 * @param {boolean} busy - True while the brute-force solver runs.
 * @returns {void}
 */
function setBusy(busy) {
  refs.randomizeBtn.disabled = busy;
  refs.clearBtn.disabled = busy;
}
