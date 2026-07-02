// Classic textbook GA for TSP: permutation encoding, order crossover (OX),
// swap mutation, tournament or roulette-wheel selection, optional elitism.

import { tourDistance } from "./state.js";

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initPopulation(size, cityIndices) {
  return Array.from({ length: size }, () => shuffled(cityIndices));
}

function tournamentSelect(population, distances, k) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (distances[idx] < bestDist) {
      bestDist = distances[idx];
      best = population[idx];
    }
  }
  return best;
}

function rouletteSelect(population, distances, cumulativeWeights, totalWeight) {
  const r = Math.random() * totalWeight;
  let lo = 0, hi = cumulativeWeights.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulativeWeights[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  return population[lo];
}

function buildRouletteWeights(distances) {
  // Minimize distance -> weight is inverse distance (fitness-proportionate).
  const weights = distances.map((d) => 1 / (d + 1e-9));
  const cumulative = [];
  let sum = 0;
  for (const w of weights) {
    sum += w;
    cumulative.push(sum);
  }
  return { cumulative, total: sum };
}

// Order Crossover (OX)
function orderCrossover(parentA, parentB) {
  const n = parentA.length;
  const child = new Array(n).fill(null);
  let i = Math.floor(Math.random() * n);
  let j = Math.floor(Math.random() * n);
  if (i > j) [i, j] = [j, i];

  const used = new Set();
  for (let k = i; k <= j; k++) {
    child[k] = parentA[k];
    used.add(parentA[k]);
  }

  let pos = (j + 1) % n;
  for (let k = 0; k < n; k++) {
    const gene = parentB[(j + 1 + k) % n];
    if (!used.has(gene)) {
      child[pos] = gene;
      used.add(gene);
      pos = (pos + 1) % n;
    }
  }
  return child;
}

function swapMutate(route) {
  const a = Math.floor(Math.random() * route.length);
  const b = Math.floor(Math.random() * route.length);
  const mutated = route.slice();
  [mutated[a], mutated[b]] = [mutated[b], mutated[a]];
  return mutated;
}

export function evaluatePopulation(population, matrix) {
  return population.map((order) => tourDistance(order, matrix));
}

export function evolve(population, distances, matrix, params) {
  const { crossoverRate, mutationRate, selection, tournamentSize, elitism } = params;
  const size = population.length;
  const nextGen = [];

  if (elitism) {
    let bestIdx = 0;
    for (let i = 1; i < size; i++) if (distances[i] < distances[bestIdx]) bestIdx = i;
    nextGen.push(population[bestIdx].slice());
  }

  const { cumulative, total } = selection === "roulette" ? buildRouletteWeights(distances) : { cumulative: null, total: 0 };

  const pick = () =>
    selection === "roulette"
      ? rouletteSelect(population, distances, cumulative, total)
      : tournamentSelect(population, distances, tournamentSize);

  while (nextGen.length < size) {
    const parentA = pick();
    const parentB = pick();
    let child = Math.random() < crossoverRate ? orderCrossover(parentA, parentB) : parentA.slice();
    if (Math.random() < mutationRate) child = swapMutate(child);
    nextGen.push(child);
  }

  return nextGen;
}
