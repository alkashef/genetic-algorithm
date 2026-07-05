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

function tournamentSelectIdx(distances, k) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * distances.length);
    if (distances[idx] < bestDist) {
      bestDist = distances[idx];
      bestIdx = idx;
    }
  }
  return bestIdx;
}

function rouletteSelectIdx(cumulativeWeights, totalWeight) {
  const r = Math.random() * totalWeight;
  let lo = 0, hi = cumulativeWeights.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulativeWeights[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  return lo;
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

// Order Crossover (OX). Returns the child plus the [start, end] segment
// that was copied straight from parentA, so callers can visualize it.
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
  return { child, start: i, end: j };
}

// Swap mutation. Returns the mutated route plus the two swapped indices.
function swapMutate(route) {
  const a = Math.floor(Math.random() * route.length);
  const b = Math.floor(Math.random() * route.length);
  const mutated = route.slice();
  [mutated[a], mutated[b]] = [mutated[b], mutated[a]];
  return { mutated, a, b };
}

export function evaluatePopulation(population, matrix) {
  return population.map((order) => tourDistance(order, matrix));
}

// --- Evolution split into separate stages so the UI can step through them. ---

// Selection: choose the parent-index pairs that will breed the next generation
// (and the elite index that survives unchanged, if elitism is on).
// Returns { pairs: [[aIdx, bIdx], ...], eliteIdx: number|null }.
export function selectParents(population, distances, params) {
  const { selection, tournamentSize, elitism } = params;
  const size = population.length;

  let eliteIdx = null;
  if (elitism) {
    eliteIdx = 0;
    for (let i = 1; i < size; i++) if (distances[i] < distances[eliteIdx]) eliteIdx = i;
  }

  const { cumulative, total } = selection === "roulette" ? buildRouletteWeights(distances) : { cumulative: null, total: 0 };
  const pickIdx = () =>
    selection === "roulette"
      ? rouletteSelectIdx(cumulative, total)
      : tournamentSelectIdx(distances, tournamentSize);

  const pairCount = size - (elitism ? 1 : 0);
  const pairs = [];
  for (let i = 0; i < pairCount; i++) pairs.push([pickIdx(), pickIdx()]);
  return { pairs, eliteIdx };
}

// Crossover: breed each parent pair with OX (subject to crossoverRate).
// Returns { children, trace } where trace[k] = { elite, crossover:{start,end}|null, mutation:null }.
export function crossoverStage(population, pairs, eliteIdx, crossoverRate) {
  const children = [];
  const trace = [];

  if (eliteIdx != null) {
    children.push(population[eliteIdx].slice());
    trace.push({ elite: true, crossover: null, mutation: null });
  }

  for (const [ai, bi] of pairs) {
    const parentA = population[ai];
    const parentB = population[bi];
    let child;
    let crossover = null;
    if (Math.random() < crossoverRate) {
      const res = orderCrossover(parentA, parentB);
      child = res.child;
      crossover = { start: res.start, end: res.end };
    } else {
      child = parentA.slice();
    }
    children.push(child);
    trace.push({ elite: false, crossover, mutation: null });
  }

  return { children, trace };
}

// Mutation: swap-mutate each child (subject to mutationRate), leaving the elite
// untouched. Mutates children/trace in place and returns children.
export function mutateStage(children, trace, mutationRate) {
  for (let k = 0; k < children.length; k++) {
    if (trace[k].elite) continue;
    if (Math.random() < mutationRate) {
      const res = swapMutate(children[k]);
      children[k] = res.mutated;
      trace[k].mutation = { a: res.a, b: res.b };
    }
  }
  return children;
}
