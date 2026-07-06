/**
 * @module bruteForceView
 * @description Owns the brute-force section: the Solve/Stop button, step
 * delay input, stat cards, and the board canvas. Streams solver events from
 * the backend via api.js and emits bruteforce:running so other views can
 * lock conflicting controls. All DOM access for that section lives here.
 */

import { streamBruteForce } from "./api.js";
import { getCities } from "./cityState.js";
import { clearCanvas, drawCities, drawRoute, drawGrid } from "./canvasUtils.js";
import { emitBruteForceRunning, onCitiesChanged } from "./events.js";
import { formatDistance, formatRoute } from "./format.js";
import { minCities } from "./uiConfig.js";

const state = { running: false, abort: null, total: 0 };
const refs = {};

/**
 * Wire up the section's controls and reset the stat display.
 *
 * @returns {void}
 */
export function initBruteForceView() {
  refs.solveBtn = document.getElementById("bfSolveBtn");
  refs.stepDelayInput = document.getElementById("bfStepDelay");
  refs.totalVal = document.getElementById("bfTotalVal");
  refs.currentVal = document.getElementById("bfCurrentVal");
  refs.currentRouteVal = document.getElementById("bfCurrentRouteVal");
  refs.currentDistVal = document.getElementById("bfCurrentDistVal");
  refs.bestVal = document.getElementById("bfBestVal");
  refs.bestRouteVal = document.getElementById("bfBestRouteVal");
  refs.progressFill = document.getElementById("bfProgressFill");
  refs.canvas = document.getElementById("setupCanvas");
  refs.ctx = refs.canvas.getContext("2d");
  refs.solveBtn.addEventListener("click", toggleSolve);
  onCitiesChanged(reset);
}

/**
 * Start a solve, or request cancellation of the one in flight.
 *
 * @returns {void}
 */
function toggleSolve() {
  if (state.running) {
    if (state.abort) state.abort.abort();
    return;
  }
  solve();
}

/**
 * Reset the stat cards and board to their idle state.
 *
 * @returns {void}
 */
function reset() {
  refs.totalVal.textContent = "";
  refs.currentVal.textContent = "—";
  refs.currentRouteVal.textContent = "—";
  refs.currentDistVal.textContent = "—";
  refs.bestVal.textContent = "—";
  refs.bestRouteVal.textContent = "—";
  refs.progressFill.style.width = "0%";
  state.total = 0;
  redrawBoard();
}

/**
 * Redraw the board: grid, city dots, and optionally the best route so far.
 *
 * @param {number[]} [bestRoute] - Best route to draw in green, if any.
 * @returns {void}
 */
function redrawBoard(bestRoute) {
  const cities = getCities();
  clearCanvas(refs.ctx, refs.canvas);
  drawGrid(refs.ctx, refs.canvas);
  drawCities(refs.ctx, refs.canvas, cities);
  if (bestRoute) drawRoute(refs.ctx, refs.canvas, cities, bestRoute, { color: "#4fd984", width: 3 });
}

/**
 * Run the streamed brute-force solve from start to done/cancel, keeping the
 * button label and run-state event in sync.
 *
 * @returns {Promise<void>} Resolves when the run finishes or is cancelled.
 */
async function solve() {
  const cities = getCities();
  if (cities.length < minCities()) {
    refs.totalVal.textContent = `need ≥ ${minCities()} cities`;
    return;
  }
  setRunning(true);
  const stepDelay = Math.max(0, parseFloat(refs.stepDelayInput.value) || 0);
  try {
    await streamBruteForce(cities, makeCallbacks(cities), state.abort.signal, stepDelay);
  } catch (err) {
    if (err.name !== "AbortError") {
      refs.totalVal.textContent = "server error";
      console.error(err);
    }
  }
  setRunning(false);
}

/**
 * Build the event callbacks that update the stats and board during a run.
 *
 * @param {Array<{x: number, y: number}>} cities - The cities being solved.
 * @returns {{onTotal: Function, onProgress: Function, onBest: Function, onDone: Function}} Stream callbacks.
 */
function makeCallbacks(cities) {
  return {
    onTotal: (total) => {
      state.total = total;
    },
    onProgress: (route, dist, count) => {
      updateProgress(count);
      refs.currentRouteVal.textContent = formatRoute(route);
      refs.currentDistVal.textContent = formatDistance(dist);
      redrawBoard();
      drawRoute(refs.ctx, refs.canvas, cities, route, { color: "#4f9dff", width: 1.5 });
    },
    onBest: (route, dist) => {
      refs.bestVal.textContent = formatDistance(dist);
      refs.bestRouteVal.textContent = formatRoute(route);
      redrawBoard(route);
    },
    onDone: (route, dist, count) => {
      if (!route) return;
      updateProgress(count);
      refs.bestVal.textContent = formatDistance(dist);
      refs.bestRouteVal.textContent = formatRoute(route);
      redrawBoard(route);
    },
  };
}

/**
 * Refresh the route-count progress bar and its "count / total" label.
 *
 * @param {number} count - Routes explored so far.
 * @returns {void}
 */
function updateProgress(count) {
  refs.currentVal.textContent = `${count.toLocaleString()} / ${state.total.toLocaleString()} routes`;
  const pct = state.total ? Math.min(100, (count / state.total) * 100) : 0;
  refs.progressFill.style.width = `${pct}%`;
}

/**
 * Flip the run state: swap the button label, create/clear the abort
 * controller, and notify other views.
 *
 * @param {boolean} running - The new run state.
 * @returns {void}
 */
function setRunning(running) {
  state.running = running;
  state.abort = running ? new AbortController() : null;
  refs.solveBtn.textContent = running ? "Stop" : "Solve";
  refs.solveBtn.classList.toggle("btn-stop", running);
  emitBruteForceRunning(running);
}
