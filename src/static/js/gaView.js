/**
 * @module gaView
 * @description Owns the genetic-algorithm section: parameter inputs, the
 * phase-step / fast-forward / reset buttons, stat cards, board canvas,
 * fitness chart, and the genome list. Drives the evolution one phase per
 * backend call (init → fitness → select → crossover → mutate → fitness …).
 * All DOM access for that section lives here.
 */

import { initPopulation, evaluatePopulation, selectParents, crossoverStage, mutateStage } from "./api.js";
import { getCities } from "./cityState.js";
import { clearCanvas, drawCities, drawTour } from "./canvasUtils.js";
import { onCitiesChanged } from "./events.js";
import { drawFitnessChart } from "./fitnessChart.js";
import { formatDistance } from "./format.js";
import { genomeRenderCap, minCities } from "./uiConfig.js";

const state = {
  population: [],
  distances: [],
  trace: null,        // per-genome crossover/mutation info for the shown genomes
  display: [],        // genomes currently rendered (population, or children mid-breeding)
  selectedSet: null,  // row indices highlighted as selected parents (select phase)
  children: null,     // children being built across crossover/mutate phases
  selected: null,     // { pairs, eliteIdx } from the select phase
  phase: "init",      // next phase to run
  generation: 0,
  avgHistory: [],
  bestEver: null,     // { order, dist }
  running: false,
  busy: false,        // a phase request is in flight (guards against re-entry)
  timer: null,
};

const refs = {};

/**
 * Wire up the section's controls and initialize the idle display.
 *
 * @returns {void}
 */
export function initGaView() {
  grabRefs();
  refs.selection.addEventListener("change", updateSelectionVisibility);
  refs.stepBtn.addEventListener("click", () => { if (!state.running) runPhase(); });
  refs.fastBtn.addEventListener("click", toggleFast);
  refs.resetBtn.addEventListener("click", reset);
  onCitiesChanged(reset);
  updateSelectionVisibility();
}

/**
 * Cache every DOM element the section uses.
 *
 * @returns {void}
 */
function grabRefs() {
  refs.popSize = document.getElementById("gaPopSize");
  refs.maxGen = document.getElementById("gaMaxGen");
  refs.crossoverRate = document.getElementById("gaCrossoverRate");
  refs.mutationRate = document.getElementById("gaMutationRate");
  refs.selection = document.getElementById("gaSelection");
  refs.tournamentSizeWrap = document.getElementById("gaTournamentSizeWrap");
  refs.tournamentSize = document.getElementById("gaTournamentSize");
  refs.elitism = document.getElementById("gaElitism");
  refs.stepBtn = document.getElementById("gaStepBtn");
  refs.fastBtn = document.getElementById("gaFastBtn");
  refs.resetBtn = document.getElementById("gaResetBtn");
  refs.genVal = document.getElementById("gaGenVal");
  refs.bestVal = document.getElementById("gaBestVal");
  refs.avgVal = document.getElementById("gaAvgVal");
  refs.stepDelay = document.getElementById("gaStepDelay");
  refs.genomeList = document.getElementById("gaGenomeList");
  refs.genomeGen = document.getElementById("gaGenomeGen");
  refs.genomePop = document.getElementById("gaGenomePop");
  refs.canvas = document.getElementById("gaCanvas");
  refs.ctx = refs.canvas.getContext("2d");
  refs.chartCanvas = document.getElementById("gaChart");
  refs.chartCtx = refs.chartCanvas.getContext("2d");
}

/**
 * Show the tournament-size input only for tournament selection.
 *
 * @returns {void}
 */
function updateSelectionVisibility() {
  refs.tournamentSizeWrap.style.display = refs.selection.value === "tournament" ? "flex" : "none";
}

/**
 * Read and clamp the GA parameters from the inputs.
 *
 * @returns {{popSize: number, maxGen: number, crossoverRate: number,
 *   mutationRate: number, selection: string, tournamentSize: number,
 *   elitism: boolean}} The validated parameters.
 */
function getParams() {
  return {
    popSize: Math.max(Number(refs.popSize.min), parseInt(refs.popSize.value, 10) || 0),
    maxGen: Math.max(Number(refs.maxGen.min), parseInt(refs.maxGen.value, 10) || 1),
    crossoverRate: Math.min(1, Math.max(0, parseFloat(refs.crossoverRate.value) || 0)),
    mutationRate: Math.min(1, Math.max(0, parseFloat(refs.mutationRate.value) || 0)),
    selection: refs.selection.value,
    tournamentSize: Math.max(Number(refs.tournamentSize.min), parseInt(refs.tournamentSize.value, 10) || 2),
    elitism: refs.elitism.checked,
  };
}

/**
 * Clear all evolution state and return the section to its idle display.
 *
 * @returns {void}
 */
function reset() {
  stopFast();
  Object.assign(state, {
    population: [], distances: [], trace: null, display: [],
    selectedSet: null, children: null, selected: null,
    phase: "init", generation: 0, avgHistory: [], bestEver: null,
  });
  const tooFew = getCities().length < minCities();
  refs.stepBtn.disabled = tooFew;
  refs.fastBtn.disabled = tooFew;
  refs.genVal.textContent = "0";
  refs.bestVal.textContent = "—";
  refs.avgVal.textContent = "—";
  redrawBoard();
  drawFitnessChart(refs.chartCtx, refs.chartCanvas, []);
  updatePhaseButton();
  renderGenomes();
}

/**
 * Record best/average stats for the just-evaluated generation.
 *
 * @returns {void}
 */
function recordStats() {
  const { population, distances } = state;
  let bestIdx = 0;
  let sum = 0;
  for (let i = 0; i < distances.length; i++) {
    sum += distances[i];
    if (distances[i] < distances[bestIdx]) bestIdx = i;
  }
  state.avgHistory.push(sum / distances.length);
  if (!state.bestEver || distances[bestIdx] < state.bestEver.dist) {
    state.bestEver = { order: population[bestIdx].slice(), dist: distances[bestIdx] };
  }
}

/**
 * Phase: create the initial random population on the backend.
 *
 * @returns {Promise<void>} Resolves when the population is stored.
 */
async function phaseInit() {
  const params = getParams();
  state.population = await initPopulation(params.popSize, getCities().length);
  Object.assign(state, {
    distances: [], trace: null, selectedSet: null, children: null, selected: null,
    generation: 0, avgHistory: [], bestEver: null,
  });
  state.display = state.population;
}

/**
 * Phase: evaluate every individual's tour distance.
 *
 * @returns {Promise<void>} Resolves when distances and stats are updated.
 */
async function phaseFitness() {
  state.distances = await evaluatePopulation(state.population, getCities());
  recordStats();
  state.trace = null;
  state.selectedSet = null;
  state.display = state.population;
}

/**
 * Phase: pick parent pairs (and elite) and highlight the selected rows.
 *
 * @returns {Promise<void>} Resolves when the selection is stored.
 */
async function phaseSelect() {
  state.selected = await selectParents(state.population, state.distances, getParams());
  const set = new Set();
  for (const [a, b] of state.selected.pairs) { set.add(a); set.add(b); }
  if (state.selected.eliteIdx != null) set.add(state.selected.eliteIdx);
  state.selectedSet = set;
  state.trace = null;
  state.display = state.population;
}

/**
 * Phase: breed the selected pairs; show the children with crossover marks.
 *
 * @returns {Promise<void>} Resolves when the children are stored.
 */
async function phaseCrossover() {
  const { pairs, eliteIdx } = state.selected;
  const res = await crossoverStage(state.population, pairs, eliteIdx, getParams().crossoverRate);
  state.children = res.children;
  state.trace = res.trace;
  state.selectedSet = null;
  state.display = res.children;
}

/**
 * Phase: mutate the children and promote them to the next generation.
 *
 * @returns {Promise<void>} Resolves when the new generation is in place.
 */
async function phaseMutate() {
  const res = await mutateStage(state.children, state.trace, getParams().mutationRate);
  state.population = res.children;
  state.trace = res.trace;
  state.children = null;
  state.generation++;
  state.display = state.population;
}

/**
 * Run the next phase in the cycle, guarding against re-entry while a
 * backend request is in flight.
 *
 * @returns {Promise<void>} Resolves when the phase and UI update finish.
 */
async function runPhase() {
  if (getCities().length < minCities() || state.busy) return;
  state.busy = true;
  try {
    await runCurrentPhase();
    state.phase = nextPhase(state.phase);
    updateUI();
    updatePhaseButton();
  } finally {
    state.busy = false;
  }
}

/**
 * Dispatch to the implementation of the phase that is due next.
 *
 * @returns {Promise<void>} Resolves when the phase completes.
 */
function runCurrentPhase() {
  switch (state.phase) {
    case "init": return phaseInit();
    case "fitness": return phaseFitness();
    case "select": return phaseSelect();
    case "crossover": return phaseCrossover();
    case "mutate": return phaseMutate();
    default: return Promise.resolve();
  }
}

/**
 * The phase that follows a given phase in the evolution cycle.
 *
 * @param {string} phase - The phase that just ran.
 * @returns {string} The next phase.
 */
function nextPhase(phase) {
  switch (phase) {
    case "init": return "fitness";
    case "fitness": return "select";
    case "select": return "crossover";
    case "crossover": return "mutate";
    default: return "fitness";
  }
}

/**
 * Human-readable button label for a phase.
 *
 * @param {string} phase - The phase identifier.
 * @returns {string} The label shown on the step button.
 */
function phaseLabel(phase) {
  switch (phase) {
    case "init": return "Initialize";
    case "fitness": return "Calculate fitness";
    case "select": return "Selection";
    case "crossover": return "Crossover";
    case "mutate": return "Mutation";
    default: return phase;
  }
}

/**
 * Show the upcoming phase's label on the step button.
 *
 * @returns {void}
 */
function updatePhaseButton() {
  refs.stepBtn.textContent = phaseLabel(state.phase);
}

/**
 * Refresh the stat cards, board, chart, and genome list.
 *
 * @returns {void}
 */
function updateUI() {
  const avg = state.avgHistory[state.avgHistory.length - 1];
  refs.genVal.textContent = state.generation.toLocaleString();
  refs.bestVal.textContent = state.bestEver ? formatDistance(state.bestEver.dist) : "—";
  refs.avgVal.textContent = avg != null ? formatDistance(avg) : "—";
  redrawBoard();
  drawFitnessChart(refs.chartCtx, refs.chartCanvas, state.avgHistory);
  renderGenomes();
}

/**
 * Redraw the board: city dots plus the best-ever tour, if any.
 *
 * @returns {void}
 */
function redrawBoard() {
  const cities = getCities();
  clearCanvas(refs.ctx, refs.canvas);
  drawCities(refs.ctx, refs.canvas, cities);
  if (state.bestEver) drawTour(refs.ctx, refs.canvas, cities, state.bestEver.order, { color: "#4fd984", width: 3 });
}

/**
 * Render the displayed genomes, highlighting crossover segments, mutation
 * swaps, elite rows, and selected parents. Rows beyond the configured cap
 * are summarized.
 *
 * @returns {void}
 */
function renderGenomes() {
  const genomes = state.display || [];
  refs.genomeGen.textContent = state.generation.toLocaleString();
  refs.genomePop.textContent = genomes.length.toLocaleString();
  if (genomes.length === 0) {
    refs.genomeList.innerHTML = "";
    return;
  }
  const cap = genomeRenderCap();
  const shown = Math.min(genomes.length, cap);
  const rows = [];
  for (let k = 0; k < shown; k++) {
    rows.push(renderGenomeRow(genomes[k], state.trace ? state.trace[k] : null, k));
  }
  if (genomes.length > shown) {
    rows.push(`<div class="genome-more">… ${(genomes.length - shown).toLocaleString()} more not shown</div>`);
  }
  refs.genomeList.innerHTML = rows.join("");
}

/**
 * Render one genome as a row of gene cells with its highlights.
 *
 * @param {number[]} genome - The tour to render.
 * @param {{elite: boolean, crossover: object | null, mutation: object | null} | null} t - Trace entry.
 * @param {number} rowIndex - Row position, used for the selected highlight.
 * @returns {string} The row's HTML.
 */
function renderGenomeRow(genome, t, rowIndex) {
  const cross = t && t.crossover;
  const mut = t && t.mutation;
  const cells = [];
  for (let g = 0; g < genome.length; g++) {
    let cls = "gene";
    if (cross && g >= cross.start && g <= cross.end) cls += " crossover";
    if (mut && (g === mut.a || g === mut.b)) cls += " mutation";
    cells.push(`<span class="${cls}">${genome[g]}</span>`);
  }
  let rowCls = "genome";
  if (t && t.elite) rowCls += " elite";
  if (state.selectedSet && state.selectedSet.has(rowIndex)) rowCls += " selected";
  return `<div class="${rowCls}">${cells.join("")}</div>`;
}

/**
 * Toggle fast-forward mode.
 *
 * @returns {void}
 */
function toggleFast() {
  if (state.running) stopFast();
  else startFast();
}

/**
 * Start auto-running phases, paced by the step-delay input.
 *
 * @returns {void}
 */
function startFast() {
  if (getCities().length < minCities()) return;
  state.running = true;
  refs.fastBtn.textContent = "Pause";
  refs.stepBtn.disabled = true;
  fastLoop();
}

/**
 * Stop auto-running and restore the buttons.
 *
 * @returns {void}
 */
function stopFast() {
  state.running = false;
  clearTimeout(state.timer);
  refs.fastBtn.textContent = "Fast forward";
  refs.fastBtn.disabled = getCities().length < minCities();
  refs.stepBtn.disabled = getCities().length < minCities();
}

/**
 * One iteration of the fast-forward loop: run a phase, then schedule the
 * next unless paused, reset, or the generation limit was reached.
 *
 * @returns {Promise<void>} Resolves when this iteration is done.
 */
async function fastLoop() {
  if (!state.running) return;
  if (state.phase === "fitness" && state.generation >= getParams().maxGen) {
    stopFast();
    return;
  }
  await runPhase();
  if (!state.running) return; // may have been paused/reset while awaiting
  const delaySec = Math.max(0, parseFloat(refs.stepDelay.value) || 0);
  state.timer = setTimeout(fastLoop, delaySec * 1000);
}
