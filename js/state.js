// Shared city state and distance helpers used by every section.
// Cities are stored in normalized [0,1] x [0,1] space so the same set can be
// drawn, at the correct relative positions, on canvases of different sizes.

export const cities = []; // { x, y } in [0,1]

export function addCity(x, y) {
  cities.push({ x, y });
}

export function setCities(newCities) {
  cities.length = 0;
  cities.push(...newCities);
}

export function clearCities() {
  cities.length = 0;
}

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

// Distance in normalized space; fine as a relative metric for comparing routes.
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

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

export function routeDistance(route, matrix) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += matrix[route[i]][route[i + 1]];
  }
  return total;
}

// Closed-tour distance for a permutation that does not repeat the start city.
export function tourDistance(order, matrix) {
  let total = 0;
  for (let i = 0; i < order.length; i++) {
    const a = order[i];
    const b = order[(i + 1) % order.length];
    total += matrix[a][b];
  }
  return total;
}
