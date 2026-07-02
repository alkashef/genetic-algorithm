import {
  cities, addCity, setCities, clearCities, randomCities,
  buildDistanceMatrix, tourDistance,
} from "./state.js";
import { clearCanvas, drawCities, drawCompleteGraph, drawTour, drawRoute } from "./canvasUtils.js";
import { runBruteForce, countRoutes } from "./bruteforce.js";
import { initPopulation, evaluatePopulation, evolve } from "./ga.js";
import { drawFitnessChart } from "./chart.js";

// ---------- Elements ----------
const cityCountInput = document.getElementById("cityCount");
const randomizeBtn = document.getElementById("randomizeBtn");
const placeModeBtn = document.getElementById("placeModeBtn");
const clearBtn = document.getElementById("clearBtn");
const cityCounter = document.getElementById("cityCounter");
const setupCanvas = document.getElementById("setupCanvas");
const setupCtx = setupCanvas.getContext("2d");

const bfRunBtn = document.getElementById("bfRunBtn");
const bfStopBtn = document.getElementById("bfStopBtn");
const bfTotalLine = document.getElementById("bfTotalLine");
const bfCurrentLine = document.getElementById("bfCurrentLine");
const bfBestLine = document.getElementById("bfBestLine");
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
const gaSpeedInput = document.getElementById("gaSpeed");
const gaStartBtn = document.getElementById("gaStartBtn");
const gaPauseBtn = document.getElementById("gaPauseBtn");
const gaStepBtn = document.getElementById("gaStepBtn");
const gaResetBtn = document.getElementById("gaResetBtn");
const gaStatsLine = document.getElementById("gaStatsLine");
const gaCanvas = document.getElementById("gaCanvas");
const gaCtx = gaCanvas.getContext("2d");
const gaChartCanvas = document.getElementById("gaChart");
const gaChartCtx = gaChartCanvas.getContext("2d");

// ---------- Section 1: city setup ----------
let placeMode = false;

function redrawAllCanvases() {
  redrawSetup();
  redrawBruteForceBoard();
  redrawGaBoard();
  cityCounter.textContent = String(cities.length);
}

function redrawSetup() {
  clearCanvas(setupCtx, setupCanvas);
  drawCompleteGraph(setupCtx, setupCanvas, cities);
  drawCities(setupCtx, setupCanvas, cities);
}

randomizeBtn.addEventListener("click", () => {
  const count = Math.max(2, Math.min(200, parseInt(cityCountInput.value, 10) || 0));
  setCities(randomCities(count));
  resetBruteForceUI();
  gaReset();
  redrawAllCanvases();
});

placeModeBtn.addEventListener("click", () => {
  placeMode = !placeMode;
  placeModeBtn.classList.toggle("active", placeMode);
  placeModeBtn.textContent = placeMode ? "Click to Add (on)" : "Click to Add";
});

setupCanvas.addEventListener("click", (e) => {
  if (!placeMode) return;
  const rect = setupCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  addCity(x, y);
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

function resetBruteForceUI() {
  bfTotalLine.textContent = "Total routes: —";
  bfCurrentLine.textContent = "Current: —";
  bfBestLine.textContent = "Best so far: —";
  redrawBruteForceBoard();
}

function redrawBruteForceBoard(bestRoute) {
  clearCanvas(bfCtx, bfCanvas);
  drawCities(bfCtx, bfCanvas, cities);
  if (bestRoute) drawRoute(bfCtx, bfCanvas, cities, bestRoute, { color: "#4fd984", width: 3 });
}

bfRunBtn.addEventListener("click", async () => {
  if (cities.length < 3) {
    bfTotalLine.textContent = "Need at least 3 cities.";
    return;
  }
  bfRunning = true;
  bfStopRequested = false;
  bfRunBtn.disabled = true;
  bfStopBtn.disabled = false;
  randomizeBtn.disabled = true;
  clearBtn.disabled = true;

  const matrix = buildDistanceMatrix(cities);
  const cityIndices = cities.map((_, i) => i);

  await runBruteForce(
    cityIndices,
    matrix,
    {
      onTotal: (total) => {
        bfTotalLine.textContent = `Total routes: ${total.toLocaleString()}`;
      },
      onProgress: (route, dist) => {
        bfCurrentLine.textContent = `Current: ${route.join(" → ")}  =  ${dist.toFixed(4)}`;
        redrawBruteForceBoard();
        drawRoute(bfCtx, bfCanvas, cities, route, { color: "#4f9dff", width: 1.5 });
      },
      onBest: (route, dist, count) => {
        bfBestLine.textContent = `Best so far (#${count.toLocaleString()}): ${route.join(" → ")}  =  ${dist.toFixed(4)}`;
        redrawBruteForceBoard(route);
      },
      onDone: (bestRoute, bestDist, count) => {
        if (bestRoute) {
          bfBestLine.textContent = `Optimal (checked ${count.toLocaleString()}): ${bestRoute.join(" → ")}  =  ${bestDist.toFixed(4)}`;
          bfCurrentLine.textContent = bfStopRequested ? "Stopped." : "Done.";
          redrawBruteForceBoard(bestRoute);
        }
      },
    },
    () => bfStopRequested
  );

  bfRunning = false;
  bfRunBtn.disabled = false;
  bfStopBtn.disabled = true;
  randomizeBtn.disabled = false;
  clearBtn.disabled = false;
});

bfStopBtn.addEventListener("click", () => {
  bfStopRequested = true;
});

// ---------- Section 3: genetic algorithm ----------
const gaState = {
  population: [],
  distances: [],
  generation: 0,
  bestHistory: [],
  avgHistory: [],
  bestEver: null, // { order, dist }
  running: false,
  timer: null,
};

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
  gaStop();
  gaState.population = [];
  gaState.distances = [];
  gaState.generation = 0;
  gaState.bestHistory = [];
  gaState.avgHistory = [];
  gaState.bestEver = null;
  gaStartBtn.disabled = cities.length < 3;
  gaStepBtn.disabled = cities.length < 3;
  gaStatsLine.textContent = "Generation: 0 | Best: — | Avg: —";
  redrawGaBoard();
  drawFitnessChart(gaChartCtx, gaChartCanvas, [], []);
}

function ensureGaPopulation() {
  if (gaState.population.length > 0) return;
  const params = getGaParams();
  const cityIndices = cities.map((_, i) => i);
  const matrix = buildDistanceMatrix(cities);
  gaState.matrix = matrix;
  gaState.population = initPopulation(params.popSize, cityIndices);
  gaState.distances = evaluatePopulation(gaState.population, matrix);
  recordGaStats();
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

function gaStepOnce() {
  if (cities.length < 3) return;
  ensureGaPopulation();
  if (gaState.generation > 0) {
    const params = getGaParams();
    gaState.population = evolve(gaState.population, gaState.distances, gaState.matrix, params);
    gaState.distances = evaluatePopulation(gaState.population, gaState.matrix);
    recordGaStats();
  }
  gaState.generation++;
  updateGaUI();
}

function updateGaUI() {
  const best = gaState.bestEver;
  const avg = gaState.avgHistory[gaState.avgHistory.length - 1];
  gaStatsLine.textContent =
    `Generation: ${gaState.generation} | Best: ${best ? best.dist.toFixed(4) : "—"} | Avg: ${avg ? avg.toFixed(4) : "—"}`;
  redrawGaBoard();
  drawFitnessChart(gaChartCtx, gaChartCanvas, gaState.bestHistory, gaState.avgHistory);
}

function redrawGaBoard() {
  clearCanvas(gaCtx, gaCanvas);
  drawCities(gaCtx, gaCanvas, cities);
  if (gaState.bestEver) drawTour(gaCtx, gaCanvas, cities, gaState.bestEver.order, { color: "#4fd984", width: 3 });
}

function gaLoop() {
  if (!gaState.running) return;
  const params = getGaParams();
  if (gaState.generation >= params.maxGen) {
    gaPause();
    return;
  }
  gaStepOnce();
  const delay = parseInt(gaSpeedInput.value, 10) || 0;
  gaState.timer = setTimeout(gaLoop, delay);
}

function gaStart() {
  if (cities.length < 3) return;
  gaState.running = true;
  gaStartBtn.disabled = true;
  gaPauseBtn.disabled = false;
  gaStepBtn.disabled = true;
  gaLoop();
}

function gaPause() {
  gaState.running = false;
  clearTimeout(gaState.timer);
  gaStartBtn.disabled = cities.length < 3;
  gaPauseBtn.disabled = true;
  gaStepBtn.disabled = cities.length < 3;
}

function gaStop() {
  gaState.running = false;
  clearTimeout(gaState.timer);
}

gaStartBtn.addEventListener("click", gaStart);
gaPauseBtn.addEventListener("click", gaPause);
gaStepBtn.addEventListener("click", () => {
  if (gaState.running) return;
  gaStepOnce();
});
gaResetBtn.addEventListener("click", gaReset);

// ---------- Init ----------
setCities(randomCities(parseInt(cityCountInput.value, 10) || 6));
resetBruteForceUI();
gaReset();
redrawAllCanvases();
