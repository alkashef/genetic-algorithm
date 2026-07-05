import {
  cities, addCity, setCities, clearCities, randomCities,
  buildDistanceMatrix, tourDistance,
} from "./state.js";
import { clearCanvas, drawCities, drawCompleteGraph, drawTour, drawRoute } from "./canvasUtils.js";
import { runBruteForce, countRoutes } from "./bruteforce.js";
import { initPopulation, evaluatePopulation, selectParents, crossoverStage, mutateStage } from "./ga.js";
import { drawFitnessChart } from "./chart.js";

// ---------- Elements ----------
const cityCountInput = document.getElementById("cityCount");
const randomizeBtn = document.getElementById("randomizeBtn");
const clearBtn = document.getElementById("clearBtn");
const cityCounter = document.getElementById("cityCounter");
const setupCanvas = document.getElementById("setupCanvas");
const setupCtx = setupCanvas.getContext("2d");

const bfSolveBtn = document.getElementById("bfSolveBtn");
const bfStepDelayInput = document.getElementById("bfStepDelay");
const bfTotalVal = document.getElementById("bfTotalVal");
const bfCurrentVal = document.getElementById("bfCurrentVal");
const bfCurrentDistVal = document.getElementById("bfCurrentDistVal");
const bfBestVal = document.getElementById("bfBestVal");
const bfCanvas = document.getElementById("bfCanvas");
const bfCtx = bfCanvas.getContext("2d");

const gaPopSizeInput = document.getElementById("gaPopSize");
const gaMaxGenInput = document.getElementById("gaMaxGen");
const gaCrossoverRateInput = document.getElementById("gaCrossoverRate");
const gaMutationRateInput = document.getElementById("gaMutationRate");
const gaSelectionSelect = document.getElementById("gaSelection");
const gaTournamentSizeWrap = document.getElementById("gaTournamentSizeWrap");
const gaTournamentSizeInput = document.getElementById("gaTournamentSize");
const gaElitismInput = document.getElementById("gaElitism");
const gaStepBtn = document.getElementById("gaStepBtn");
const gaFastBtn = document.getElementById("gaFastBtn");
const gaResetBtn = document.getElementById("gaResetBtn");
const gaGenVal = document.getElementById("gaGenVal");
const gaBestVal = document.getElementById("gaBestVal");
const gaAvgVal = document.getElementById("gaAvgVal");
const gaStepDelayInput = document.getElementById("gaStepDelay");
const gaGenomeList = document.getElementById("gaGenomeList");
const gaGenomeGen = document.getElementById("gaGenomeGen");
const gaGenomePop = document.getElementById("gaGenomePop");
const gaCanvas = document.getElementById("gaCanvas");
const gaCtx = gaCanvas.getContext("2d");
const gaChartCanvas = document.getElementById("gaChart");
const gaChartCtx = gaChartCanvas.getContext("2d");

// ---------- Section 1: city setup ----------
function redrawAllCanvases() {
  redrawSetup();
  redrawBruteForceBoard();
  redrawGaBoard();
  cityCounter.textContent = String(cities.length);
}

function redrawSetup() {
  clearCanvas(setupCtx, setupCanvas);
  const distMatrix = buildDistanceMatrix(cities);
  drawCompleteGraph(setupCtx, setupCanvas, cities, { showDistances: true, distMatrix });
  drawCities(setupCtx, setupCanvas, cities);
}

randomizeBtn.addEventListener("click", () => {
  const count = Math.max(2, Math.min(200, parseInt(cityCountInput.value, 10) || 0));
  setCities(randomCities(count));
  resetBruteForceUI();
  gaReset();
  redrawAllCanvases();
});

clearBtn.addEventListener("click", () => {
  clearCities();
  resetBruteForceUI();
  gaReset();
  redrawAllCanvases();
});

// ---------- Section 2: brute force ----------
let bfStopRequested = false;
let bfRunning = false;
let bfTotal = 0;

function resetBruteForceUI() {
  bfTotalVal.textContent = "—";
  bfCurrentVal.textContent = "—";
  bfCurrentDistVal.textContent = "—";
  bfBestVal.textContent = "—";
  bfTotal = 0;
  redrawBruteForceBoard();
}

function redrawBruteForceBoard(bestRoute) {
  clearCanvas(bfCtx, bfCanvas);
  drawCities(bfCtx, bfCanvas, cities);
  if (bestRoute) drawRoute(bfCtx, bfCanvas, cities, bestRoute, { color: "#4fd984", width: 3 });
}

function formatDist(dist) {
  return Math.round(dist * 1000).toLocaleString();
}

async function runBF() {
  if (cities.length < 3) {
    bfTotalVal.textContent = "need ≥ 3 cities";
    return;
  }
  bfRunning = true;
  bfStopRequested = false;
  bfSolveBtn.textContent = "Stop";
  randomizeBtn.disabled = true;
  clearBtn.disabled = true;

  const matrix = buildDistanceMatrix(cities);
  const cityIndices = cities.map((_, i) => i);

  const stepDelay = Math.max(0, parseFloat(bfStepDelayInput.value) || 3);
  await runBruteForce(
    cityIndices,
    matrix,
    {
      onTotal: (total) => {
        bfTotal = total;
        bfTotalVal.textContent = total.toLocaleString();
      },
      onProgress: (route, dist, count) => {
        bfCurrentVal.textContent = `${count.toLocaleString()}/${bfTotal.toLocaleString()}`;
        bfCurrentDistVal.textContent = formatDist(dist);
        redrawBruteForceBoard();
        drawRoute(bfCtx, bfCanvas, cities, route, { color: "#4f9dff", width: 1.5 });
      },
      onBest: (route, dist, count) => {
        bfBestVal.textContent = formatDist(dist);
        redrawBruteForceBoard(route);
      },
      onDone: (bestRoute, bestDist, count) => {
        if (bestRoute) {
          bfCurrentVal.textContent = `${count.toLocaleString()}/${bfTotal.toLocaleString()}`;
          bfBestVal.textContent = formatDist(bestDist);
          redrawBruteForceBoard(bestRoute);
        }
      },
    },
    () => bfStopRequested,
    stepDelay
  );

  bfRunning = false;
  bfSolveBtn.textContent = "Solve";
  randomizeBtn.disabled = false;
  clearBtn.disabled = false;
}

bfSolveBtn.addEventListener("click", () => {
  if (bfRunning) {
    bfStopRequested = true;
  } else {
    runBF();
  }
});

// ---------- Section 3: genetic algorithm ----------
const gaState = {
  population: [],
  distances: [],
  matrix: null,
  trace: null,        // per-genome crossover/mutation info for the shown genomes
  display: [],        // genomes currently rendered (population, or children mid-breeding)
  selectedSet: null,  // row indices highlighted as selected parents (select phase)
  children: null,     // children being built across crossover/mutate phases
  selected: null,     // { pairs, eliteIdx } from the select phase
  phase: "init",      // next phase to run: init|fitness|select|crossover|mutate
  generation: 0,
  bestHistory: [],
  avgHistory: [],
  bestEver: null,     // { order, dist }
  running: false,
  timer: null,
};

// Human-readable label for each phase, shown on the step button.
const GA_PHASE_LABEL = {
  init: "Initialize",
  fitness: "Calculate fitness",
  select: "Selection",
  crossover: "Crossover",
  mutate: "Mutation",
};

function gaNextPhase(phase) {
  switch (phase) {
    case "init": return "fitness";
    case "fitness": return "select";
    case "select": return "crossover";
    case "crossover": return "mutate";
    case "mutate": return "fitness";
    default: return "fitness";
  }
}

gaSelectionSelect.addEventListener("change", updateSelectionVisibility);
function updateSelectionVisibility() {
  gaTournamentSizeWrap.style.display = gaSelectionSelect.value === "tournament" ? "flex" : "none";
}
updateSelectionVisibility();

function getGaParams() {
  return {
    popSize: Math.max(4, parseInt(gaPopSizeInput.value, 10) || 4),
    maxGen: Math.max(1, parseInt(gaMaxGenInput.value, 10) || 1),
    crossoverRate: Math.min(1, Math.max(0, parseFloat(gaCrossoverRateInput.value) || 0)),
    mutationRate: Math.min(1, Math.max(0, parseFloat(gaMutationRateInput.value) || 0)),
    selection: gaSelectionSelect.value,
    tournamentSize: Math.max(2, parseInt(gaTournamentSizeInput.value, 10) || 2),
    elitism: gaElitismInput.checked,
  };
}

function gaReset() {
  gaStopFast();
  gaState.population = [];
  gaState.distances = [];
  gaState.matrix = null;
  gaState.trace = null;
  gaState.display = [];
  gaState.selectedSet = null;
  gaState.children = null;
  gaState.selected = null;
  gaState.phase = "init";
  gaState.generation = 0;
  gaState.bestHistory = [];
  gaState.avgHistory = [];
  gaState.bestEver = null;
  gaStepBtn.disabled = cities.length < 3;
  gaFastBtn.disabled = cities.length < 3;
  gaGenVal.textContent = "0";
  gaBestVal.textContent = "—";
  gaAvgVal.textContent = "—";
  redrawGaBoard();
  drawFitnessChart(gaChartCtx, gaChartCanvas, [], []);
  updatePhaseButton();
  renderGenomes();
}

function recordGaStats() {
  const { population, distances } = gaState;
  let bestIdx = 0;
  let sum = 0;
  for (let i = 0; i < distances.length; i++) {
    sum += distances[i];
    if (distances[i] < distances[bestIdx]) bestIdx = i;
  }
  const bestDist = distances[bestIdx];
  const avgDist = sum / distances.length;
  gaState.bestHistory.push(bestDist);
  gaState.avgHistory.push(avgDist);
  if (!gaState.bestEver || bestDist < gaState.bestEver.dist) {
    gaState.bestEver = { order: population[bestIdx].slice(), dist: bestDist };
  }
}

// --- Phase machine: each click of the step button runs one phase. ---

function phaseInit() {
  const params = getGaParams();
  const cityIndices = cities.map((_, i) => i);
  gaState.matrix = buildDistanceMatrix(cities);
  gaState.population = initPopulation(params.popSize, cityIndices);
  gaState.distances = [];
  gaState.trace = null;
  gaState.selectedSet = null;
  gaState.children = null;
  gaState.selected = null;
  gaState.generation = 0;
  gaState.bestHistory = [];
  gaState.avgHistory = [];
  gaState.bestEver = null;
  gaState.display = gaState.population;
}

function phaseFitness() {
  gaState.distances = evaluatePopulation(gaState.population, gaState.matrix);
  recordGaStats();
  gaState.trace = null;
  gaState.selectedSet = null;
  gaState.display = gaState.population;
}

function phaseSelect() {
  const params = getGaParams();
  gaState.selected = selectParents(gaState.population, gaState.distances, params);
  const set = new Set();
  for (const [a, b] of gaState.selected.pairs) { set.add(a); set.add(b); }
  if (gaState.selected.eliteIdx != null) set.add(gaState.selected.eliteIdx);
  gaState.selectedSet = set;
  gaState.trace = null;
  gaState.display = gaState.population;
}

function phaseCrossover() {
  const params = getGaParams();
  const { pairs, eliteIdx } = gaState.selected;
  const { children, trace } = crossoverStage(gaState.population, pairs, eliteIdx, params.crossoverRate);
  gaState.children = children;
  gaState.trace = trace;
  gaState.selectedSet = null;
  gaState.display = children; // show the freshly bred children with crossover marks
}

function phaseMutate() {
  const params = getGaParams();
  mutateStage(gaState.children, gaState.trace, params.mutationRate);
  gaState.population = gaState.children;
  gaState.children = null;
  gaState.generation++;
  gaState.display = gaState.population;
}

function gaRunPhase() {
  if (cities.length < 3) return;
  switch (gaState.phase) {
    case "init": phaseInit(); break;
    case "fitness": phaseFitness(); break;
    case "select": phaseSelect(); break;
    case "crossover": phaseCrossover(); break;
    case "mutate": phaseMutate(); break;
  }
  gaState.phase = gaNextPhase(gaState.phase);
  updateGaUI();
  updatePhaseButton();
}

function updatePhaseButton() {
  gaStepBtn.textContent = GA_PHASE_LABEL[gaState.phase];
}

function updateGaUI() {
  const best = gaState.bestEver;
  const avg = gaState.avgHistory[gaState.avgHistory.length - 1];
  gaGenVal.textContent = gaState.generation.toLocaleString();
  gaBestVal.textContent = best ? formatDist(best.dist) : "—";
  gaAvgVal.textContent = avg != null ? formatDist(avg) : "—";
  redrawGaBoard();
  drawFitnessChart(gaChartCtx, gaChartCanvas, gaState.bestHistory, gaState.avgHistory);
  renderGenomes();
}

// Show the population as a list of genomes (arrays of genes). Genes touched by
// the last generation's crossover segment / mutation swap are highlighted.
const GENOME_RENDER_CAP = 400;

function renderGenomes() {
  const genomes = gaState.display || [];
  const trace = gaState.trace;
  const selected = gaState.selectedSet;
  gaGenomeGen.textContent = gaState.generation.toLocaleString();
  gaGenomePop.textContent = genomes.length.toLocaleString();

  if (genomes.length === 0) {
    gaGenomeList.innerHTML = "";
    return;
  }

  const shown = Math.min(genomes.length, GENOME_RENDER_CAP);
  const rows = [];
  for (let k = 0; k < shown; k++) {
    const genome = genomes[k];
    const t = trace ? trace[k] : null;
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
    if (selected && selected.has(k)) rowCls += " selected";
    rows.push(`<div class="${rowCls}">${cells.join("")}</div>`);
  }
  if (genomes.length > shown) {
    rows.push(`<div class="genome-more">… ${(genomes.length - shown).toLocaleString()} more not shown</div>`);
  }
  gaGenomeList.innerHTML = rows.join("");
}

function redrawGaBoard() {
  clearCanvas(gaCtx, gaCanvas);
  drawCities(gaCtx, gaCanvas, cities);
  if (gaState.bestEver) drawTour(gaCtx, gaCanvas, cities, gaState.bestEver.order, { color: "#4fd984", width: 3 });
}

// --- Fast forward: auto-runs the phase machine, pausing `delay` between phases. ---

function gaFastLoop() {
  if (!gaState.running) return;
  const params = getGaParams();
  // Stop once we've evolved maxGen generations and are back at a generation boundary.
  if (gaState.phase === "fitness" && gaState.generation >= params.maxGen) {
    gaStopFast();
    return;
  }
  gaRunPhase();
  const delaySec = Math.max(0, parseFloat(gaStepDelayInput.value) || 0);
  gaState.timer = setTimeout(gaFastLoop, delaySec * 1000);
}

function gaStartFast() {
  if (cities.length < 3) return;
  gaState.running = true;
  gaFastBtn.textContent = "Pause";
  gaStepBtn.disabled = true;
  gaFastLoop();
}

function gaStopFast() {
  gaState.running = false;
  clearTimeout(gaState.timer);
  gaFastBtn.textContent = "Fast forward";
  gaFastBtn.disabled = cities.length < 3;
  gaStepBtn.disabled = cities.length < 3;
}

gaStepBtn.addEventListener("click", () => {
  if (gaState.running) return;
  gaRunPhase();
});
gaFastBtn.addEventListener("click", () => {
  if (gaState.running) gaStopFast();
  else gaStartFast();
});
gaResetBtn.addEventListener("click", gaReset);

// ---------- Tabs ----------
const tabButtons = document.querySelectorAll(".tab");
const tabPanels = document.querySelectorAll(".tab-panel");
tabButtons.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabButtons.forEach((t) => t.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// ---------- Init ----------
setCities(randomCities(parseInt(cityCountInput.value, 10) || 6));
resetBruteForceUI();
gaReset();
redrawAllCanvases();
