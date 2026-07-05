// Brute force TSP solver: enumerates every route via Heap's algorithm.
// The start city is fixed and mirror-image routes are skipped, so the
// true number of distinct routes explored is (n-1)!/2.

import { routeDistance } from "./state.js";

function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

export function countRoutes(n) {
  if (n <= 2) return 1;
  return factorial(n - 1) / 2;
}

// Generator yielding permutations of `arr` in place (Heap's algorithm).
// Caller must copy the yielded array if it needs to keep it.
function* heapPermutations(arr) {
  const n = arr.length;
  const c = new Array(n).fill(0);
  yield arr;
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const swapIndex = i % 2 === 0 ? 0 : c[i];
      [arr[swapIndex], arr[i]] = [arr[i], arr[swapIndex]];
      yield arr;
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

function nextFrame(delay = 0) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// cityIndices: array of city indices to route, e.g. [0,1,2,...,n-1].
// callbacks: { onTotal(total), onProgress(route, dist, count), onBest(route, dist, count), onDone(bestRoute, bestDist, count) }
// shouldStop: () => boolean, checked periodically to allow cancellation.
// stepDelay: delay in seconds between each step calculation (default: 3).
export async function runBruteForce(cityIndices, matrix, callbacks, shouldStop, stepDelay = 3) {
  const start = cityIndices[0];
  const rest = cityIndices.slice(1);
  const total = countRoutes(cityIndices.length);
  callbacks.onTotal(total);

  if (rest.length === 0) {
    const route = [start, start];
    const dist = routeDistance(route, matrix);
    callbacks.onBest(route, dist, 1);
    callbacks.onDone(route, dist, 1);
    return;
  }

  let count = 0;
  let bestRoute = null;
  let bestDist = Infinity;
  let lastUpdate = performance.now();
  const stepDelayMs = stepDelay * 1000;

  for (const perm of heapPermutations(rest)) {
    if (shouldStop()) break;

    // Skip mirror-image duplicates (fixed start, so reversed route is redundant).
    if (perm.length > 1 && perm[0] > perm[perm.length - 1]) continue;

    count++;
    const route = [start, ...perm, start];
    const dist = routeDistance(route, matrix);

    if (dist < bestDist) {
      bestDist = dist;
      bestRoute = route.slice();
      callbacks.onBest(bestRoute, bestDist, count);
    }

    const now = performance.now();
    if (count === 1 || now - lastUpdate > 25) {
      callbacks.onProgress(route, dist, count);
      lastUpdate = now;
      await nextFrame(stepDelayMs);
    }
  }

  callbacks.onDone(bestRoute, bestDist, count);
}
