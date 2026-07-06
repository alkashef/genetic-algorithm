/**
 * @module gaView
 * @description Owns the genetic-algorithm section: parameter inputs, the
 * phase-step / fast-forward / reset buttons, stat cards, board canvas, the
 * side-by-side current-generation / children genome tables, and the fitness
 * chart. Drives the evolution one phase per backend call (init → fitness →
 * select → crossover → mutate → fitness …). All DOM access for that section
 * lives here.
 */

import { initPopulation, evaluatePopulation, selectParents, crossoverStage, mutateStage } from "./api.js";
import { getCities } from "./cityState.js";
import { clearCanvas, drawCities, drawTour, drawGrid } from "./canvasUtils.js";
import { onCitiesChanged } from "./events.js";
import { formatDistance, formatRoute } from "./format.js";
import { drawFitnessChart } from "./fitnessChart.js";
import { genomeRenderCap, minCities } from "./uiConfig.js";

const state = {
  population: [],
  distances: [],
  trace: null,        // per-genome crossover/mutation info; belongs to state.children
                       // while they exist, and to state.population once mutate promotes them
  selectedSet: null,  // row indices highlighted as selected parents (select phase)
  children: null,     // children being built across crossover/mutate phases
  selected: null,     // { pairs, eliteIndices } from the select phase
  phase: "init",      // next phase to run
  generation: 0,
  avgHistory: [],
  bestEver: null,     // { order, dist }
  running: false,
  busy: false,        // a phase request is in flight (guards against re-entry)
  timer: null,
  genomeFilters: { idx: "", route: "", dist: "", flags: "" },
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
  refs.filterIdx.addEventListener("input", () => updateGenomeFilter("idx", refs.filterIdx.value));
  refs.filterRoute.addEventListener("input", () => updateGenomeFilter("route", refs.filterRoute.value));
  refs.filterDist.addEventListener("input", () => updateGenomeFilter("dist", refs.filterDist.value));
  refs.filterFlags.addEventListener("input", () => updateGenomeFilter("flags", refs.filterFlags.value));
  onCitiesChanged(reset);
  updateSelectionVisibility();
  // The GA tab starts hidden (display:none), so its width is 0 until the tab
  // is opened; re-stretch the canvas once that resize actually happens.
  new ResizeObserver(redrawFitnessChart).observe(refs.fitnessCanvas.parentElement);
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
  refs.eliteCount = document.getElementById("gaEliteCount");
  refs.genomeLength = document.getElementById("gaGenomeLength");
  refs.stepBtn = document.getElementById("gaStepBtn");
  refs.fastBtn = document.getElementById("gaFastBtn");
  refs.resetBtn = document.getElementById("gaResetBtn");
  refs.genVal = document.getElementById("gaGenVal");
  refs.progressFill = document.getElementById("gaProgressFill");
  refs.generationVal = document.getElementById("gaGenerationVal");
  refs.bestVal = document.getElementById("gaBestVal");
  refs.bestRouteVal = document.getElementById("gaBestRouteVal");
  refs.avgVal = document.getElementById("gaAvgVal");
  refs.stepDelay = document.getElementById("gaStepDelay");
  refs.genomeTbody = document.getElementById("gaGenomeTbody");
  refs.genomeGen = document.getElementById("gaGenomeGen");
  refs.genomePop = document.getElementById("gaGenomePop");
  refs.genomeTbodyChildren = document.getElementById("gaGenomeTbodyChildren");
  refs.genomeChildrenCount = document.getElementById("gaGenomeChildrenCount");
  refs.fitnessCanvas = document.getElementById("gaFitnessChart");
  refs.fitnessCtx = refs.fitnessCanvas.getContext("2d");
  refs.filterIdx = document.getElementById("gaFilterIdx");
  refs.filterRoute = document.getElementById("gaFilterRoute");
  refs.filterDist = document.getElementById("gaFilterDist");
  refs.filterFlags = document.getElementById("gaFilterFlags");
  refs.canvas = document.getElementById("setupCanvas");
  refs.ctx = refs.canvas.getContext("2d");
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
 *   eliteCount: number}} The validated parameters.
 */
function getParams() {
  return {
    popSize: Math.max(Number(refs.popSize.min), parseInt(refs.popSize.value, 10) || 0),
    maxGen: Math.max(Number(refs.maxGen.min), parseInt(refs.maxGen.value, 10) || 1),
    crossoverRate: Math.min(1, Math.max(0, parseFloat(refs.crossoverRate.value) || 0)),
    mutationRate: Math.min(1, Math.max(0, parseFloat(refs.mutationRate.value) || 0)),
    selection: refs.selection.value,
    tournamentSize: Math.max(Number(refs.tournamentSize.min), parseInt(refs.tournamentSize.value, 10) || 2),
    eliteCount: Math.max(Number(refs.eliteCount.min), parseInt(refs.eliteCount.value, 10) || 0),
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
    population: [], distances: [], trace: null,
    selectedSet: null, children: null, selected: null,
    phase: "init", generation: 0, avgHistory: [], bestEver: null,
    genomeFilters: { idx: "", route: "", dist: "", flags: "" },
  });
  refs.genomeLength.value = getCities().length;
  redrawFitnessChart();
  const tooFew = getCities().length < minCities();
  refs.stepBtn.disabled = tooFew;
  refs.fastBtn.disabled = tooFew;
  refs.bestVal.textContent = "—";
  refs.bestRouteVal.textContent = "—";
  refs.avgVal.textContent = "—";
  refs.filterIdx.value = "";
  refs.filterRoute.value = "";
  refs.filterDist.value = "";
  refs.filterFlags.value = "";
  updateGenProgress();
  redrawBoard();
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
}

/**
 * Phase: pick parent pairs (and elites) and highlight the selected rows.
 *
 * @returns {Promise<void>} Resolves when the selection is stored.
 */
async function phaseSelect() {
  state.selected = await selectParents(state.population, state.distances, getParams());
  const set = new Set();
  for (const [a, b] of state.selected.pairs) { set.add(a); set.add(b); }
  for (const idx of state.selected.eliteIndices) set.add(idx);
  state.selectedSet = set;
  state.trace = null;
}

/**
 * Phase: breed the selected pairs; show the children with crossover marks.
 *
 * @returns {Promise<void>} Resolves when the children are stored.
 */
async function phaseCrossover() {
  const { pairs, eliteIndices } = state.selected;
  const res = await crossoverStage(state.population, pairs, eliteIndices, getParams().crossoverRate);
  state.children = res.children;
  state.trace = res.trace;
  state.selectedSet = null;
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
 * Refresh the stat cards, progress bar, board, and genome tables.
 *
 * @returns {void}
 */
function updateUI() {
  const avg = state.avgHistory[state.avgHistory.length - 1];
  updateGenProgress();
  refs.bestVal.textContent = state.bestEver ? formatDistance(state.bestEver.dist) : "—";
  refs.bestRouteVal.textContent = state.bestEver ? formatRoute(state.bestEver.order) : "—";
  refs.avgVal.textContent = avg != null ? formatDistance(avg) : "—";
  redrawBoard();
  renderGenomes();
  redrawFitnessChart();
}

/**
 * Stretch the fitness canvas to its wrapper's full width, then redraw it.
 *
 * @returns {void}
 */
function redrawFitnessChart() {
  refs.fitnessCanvas.width = refs.fitnessCanvas.parentElement.clientWidth;
  drawFitnessChart(refs.fitnessCtx, refs.fitnessCanvas, state.avgHistory);
}

/**
 * Refresh the generation progress bar's fill and "generation / max" label.
 *
 * @returns {void}
 */
function updateGenProgress() {
  const maxGen = getParams().maxGen;
  const pct = maxGen > 0 ? Math.min(100, (state.generation / maxGen) * 100) : 0;
  refs.progressFill.style.width = `${pct}%`;
  refs.genVal.textContent = `${state.generation.toLocaleString()} / ${maxGen.toLocaleString()}`;
  refs.generationVal.textContent = state.generation.toLocaleString();
}

/**
 * Redraw the board: city dots plus the best-ever tour, if any.
 *
 * @returns {void}
 */
function redrawBoard() {
  const cities = getCities();
  clearCanvas(refs.ctx, refs.canvas);
  drawGrid(refs.ctx, refs.canvas);
  drawCities(refs.ctx, refs.canvas, cities);
  if (state.bestEver) drawTour(refs.ctx, refs.canvas, cities, state.bestEver.order, { color: "#4fd984", width: 3 });
}

/**
 * Render both genome tables: the current generation (left, filterable) and
 * its children being bred (right). Trace (crossover/mutation/elite) belongs
 * to whichever array it currently describes — the children while they
 * exist, or the population once mutate() has promoted them.
 *
 * @returns {void}
 */
function renderGenomes() {
  renderCurrentTable(state.children ? null : state.trace);
  renderChildrenTable(state.trace);
}

/**
 * Render the current-generation table, honoring the active column filters.
 * Rows beyond the configured cap are summarized.
 *
 * @param {object[] | null} trace - Per-genome trace, or null if inapplicable.
 * @returns {void}
 */
function renderCurrentTable(trace) {
  const genomes = state.population;
  refs.genomeGen.textContent = state.generation.toLocaleString();
  refs.genomePop.textContent = genomes.length.toLocaleString();
  if (genomes.length === 0) {
    refs.genomeTbody.innerHTML = "";
    return;
  }
  const cap = genomeRenderCap();
  const shown = Math.min(genomes.length, cap);
  const distancesValid = state.distances.length === genomes.length;
  const rows = [];
  for (let k = 0; k < shown; k++) {
    const dist = distancesValid ? state.distances[k] : null;
    const row = buildGenomeRow(genomes[k], trace ? trace[k] : null, k, dist, state.selectedSet, true);
    if (matchesGenomeFilters(row.search)) rows.push(row.html);
  }
  if (genomes.length > shown) {
    rows.push(`<tr><td colspan="4" class="genome-more">… ${(genomes.length - shown).toLocaleString()} more not shown</td></tr>`);
  }
  refs.genomeTbody.innerHTML = rows.join("");
}

/**
 * Render the children table (the next generation being bred). Unfiltered —
 * empty until the crossover phase produces children for this generation.
 *
 * @param {object[] | null} trace - Per-genome trace, or null if inapplicable.
 * @returns {void}
 */
function renderChildrenTable(trace) {
  const genomes = state.children || [];
  refs.genomeChildrenCount.textContent = genomes.length.toLocaleString();
  if (genomes.length === 0) {
    refs.genomeTbodyChildren.innerHTML = "";
    return;
  }
  const cap = genomeRenderCap();
  const shown = Math.min(genomes.length, cap);
  const rows = [];
  for (let k = 0; k < shown; k++) {
    rows.push(buildGenomeRow(genomes[k], trace ? trace[k] : null, k, null, null, false).html);
  }
  if (genomes.length > shown) {
    rows.push(`<tr><td colspan="3" class="genome-more">… ${(genomes.length - shown).toLocaleString()} more not shown</td></tr>`);
  }
  refs.genomeTbodyChildren.innerHTML = rows.join("");
}

/**
 * Build one genome's table row along with the searchable text used to test
 * it against the column filters.
 *
 * @param {number[]} genome - The tour to render.
 * @param {{elite: boolean, crossover: object | null, mutation: object | null} | null} t - Trace entry.
 * @param {number} rowIndex - Row position, used for the selected highlight.
 * @param {number | null} dist - The genome's distance, or null if not yet known.
 * @param {Set<number> | null} selectedSet - Row indices to flag as selected, if any.
 * @param {boolean} showDist - Whether to render the Distance column.
 * @returns {{html: string, search: {idx: string, route: string, dist: string, flags: string}}} Row markup and filter text.
 */
function buildGenomeRow(genome, t, rowIndex, dist, selectedSet, showDist) {
  const cross = t && t.crossover;
  const mut = t && t.mutation;
  const cells = [];
  for (let g = 0; g < genome.length; g++) {
    let cls = "gene";
    if (cross && g >= cross.start && g <= cross.end) cls += " crossover";
    if (mut && (g === mut.a || g === mut.b)) cls += " mutation";
    cells.push(`<span class="${cls}">${genome[g]}</span>`);
  }
  const isElite = Boolean(t && t.elite);
  const isSelected = Boolean(selectedSet && selectedSet.has(rowIndex));
  const flags = [];
  if (isElite) flags.push('<span class="flag-pill elite">Elite</span>');
  if (isSelected) flags.push('<span class="flag-pill selected">Selected</span>');
  let rowCls = "";
  if (isElite) rowCls += " is-elite";
  if (isSelected) rowCls += " is-selected";
  const distText = dist != null ? formatDistance(dist) : "—";
  const distCell = showDist ? `<td class="dist">${distText}</td>` : "";
  const html = `<tr class="${rowCls.trim()}">
    <td class="idx">${rowIndex}</td>
    <td><div class="gene-seq">${cells.join("")}</div></td>
    ${distCell}
    <td>${flags.join(" ")}</td>
  </tr>`;
  const search = {
    idx: String(rowIndex),
    route: genome.join(","),
    dist: distText,
    flags: [isElite ? "elite" : "", isSelected ? "selected" : ""].join(" "),
  };
  return { html, search };
}

/**
 * Check a built row's searchable text against the active per-column filters.
 *
 * @param {{idx: string, route: string, dist: string, flags: string}} search - Row text from buildGenomeRow().
 * @returns {boolean} True if the row passes every active filter.
 */
function matchesGenomeFilters(search) {
  const f = state.genomeFilters;
  return (!f.idx || search.idx.includes(f.idx))
    && (!f.route || search.route.includes(f.route))
    && (!f.dist || search.dist.includes(f.dist))
    && (!f.flags || search.flags.includes(f.flags));
}

/**
 * Update one genome-table column filter and re-render the table.
 *
 * @param {"idx"|"route"|"dist"|"flags"} column - Which filter changed.
 * @param {string} value - The raw input value.
 * @returns {void}
 */
function updateGenomeFilter(column, value) {
  state.genomeFilters[column] = value.trim().toLowerCase();
  renderGenomes();
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
  refs.fastBtn.classList.add("btn-stop");
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
  refs.fastBtn.classList.remove("btn-stop");
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
