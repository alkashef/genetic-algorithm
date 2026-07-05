/**
 * @module canvasUtils
 * @description Shared drawing helpers for city points and tours on a canvas.
 * City coordinates are normalized [0,1]; every helper scales by the target
 * canvas's own width/height so one city set renders correctly on any canvas.
 */

/**
 * Clear the full canvas surface.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {HTMLCanvasElement} canvas - Canvas owning the context.
 * @returns {void}
 */
export function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draw a light grey grid matching the snap-to-grid intersections.
 * Grid is 20×20 in normalized space, so spacing is calculated as canvas size / 20.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {HTMLCanvasElement} canvas - Canvas owning the context.
 * @param {{color?: string, width?: number}} [options] - Grid styling.
 * @returns {void}
 */
export function drawGrid(ctx, canvas, { color = "rgba(180, 180, 180, 0.35)", width = 0.5 } = {}) {
  const gridSize = 0.05;
  const spacingX = canvas.width * gridSize;
  const spacingY = canvas.height * gridSize;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;

  for (let x = 0; x <= canvas.width; x += spacingX) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += spacingY) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

/**
 * Snap a normalized coordinate to the nearest grid intersection.
 * Grid spacing is 1/20 of normalized space (20×20 grid).
 *
 * @param {{x: number, y: number}} c - City in normalized space.
 * @returns {{x: number, y: number}} Snapped coordinates.
 */
export function snapToGrid(c) {
  const gridSize = 0.05;
  return {
    x: Math.round(c.x / gridSize) * gridSize,
    y: Math.round(c.y / gridSize) * gridSize,
  };
}

/**
 * Get the distance between two horizontally or vertically adjacent grid intersections.
 * Grid spacing is 0.05 in normalized space (1/20 of the [0,1] range).
 *
 * @returns {number} Grid spacing distance in normalized units.
 */
export function getGridSpacingDistance() {
  return 0.05;
}

/**
 * Convert a normalized city coordinate to canvas pixels.
 *
 * @param {{x: number, y: number}} c - City in normalized space.
 * @param {HTMLCanvasElement} canvas - Canvas providing the scale.
 * @returns {{x: number, y: number}} Pixel coordinates.
 */
function px(c, canvas) {
  return { x: c.x * canvas.width, y: c.y * canvas.height };
}

/**
 * Draw every city as a dot, optionally labeled with its index.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {HTMLCanvasElement} canvas - Canvas owning the context.
 * @param {Array<{x: number, y: number}>} cities - Cities to draw.
 * @param {{radius?: number, color?: string, labels?: boolean}} [options] - Styling.
 * @returns {void}
 */
export function drawCities(ctx, canvas, cities, { radius = 5, color = "#1a2235", labels = true } = {}) {
  cities.forEach((c, i) => {
    const p = px(c, canvas);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (labels) {
      ctx.fillStyle = "#667085";
      ctx.font = "11px monospace";
      ctx.fillText(String(i), p.x + radius + 2, p.y - radius);
    }
  });
}

/**
 * Draw the complete graph over all cities, optionally labeling each edge
 * with its distance.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {HTMLCanvasElement} canvas - Canvas owning the context.
 * @param {Array<{x: number, y: number}>} cities - Cities to connect.
 * @param {{color?: string, showDistances?: boolean, distMatrix?: number[][]}} [options] - Styling.
 * @returns {void}
 */
export function drawCompleteGraph(ctx, canvas, cities, { color = "rgba(37,99,235,0.25)", showDistances = false, distMatrix = null } = {}) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < cities.length; i++) {
    const a = px(cities[i], canvas);
    for (let j = i + 1; j < cities.length; j++) {
      const b = px(cities[j], canvas);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (showDistances && distMatrix) drawEdgeLabel(ctx, a, b, distMatrix[i][j]);
    }
  }
}

/**
 * Label the midpoint of one graph edge with its ×1000 distance.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {{x: number, y: number}} a - Edge start in pixels.
 * @param {{x: number, y: number}} b - Edge end in pixels.
 * @param {number} dist - Edge distance in normalized units.
 * @returns {void}
 */
function drawEdgeLabel(ctx, a, b, dist) {
  ctx.fillStyle = "rgba(79,157,255,0.6)";
  ctx.font = "10px monospace";
  ctx.fillText(String(Math.round(dist * 1000)), (a.x + b.x) / 2 + 2, (a.y + b.y) / 2 - 2);
}

/**
 * Draw a closed tour from a permutation of city indices (the last city
 * connects back to the first).
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {HTMLCanvasElement} canvas - Canvas owning the context.
 * @param {Array<{x: number, y: number}>} cities - City positions.
 * @param {number[]} order - Permutation of city indices.
 * @param {{color?: string, width?: number, closed?: boolean}} [options] - Styling.
 * @returns {void}
 */
export function drawTour(ctx, canvas, cities, order, { color = "#4f9dff", width = 2, closed = true } = {}) {
  if (order.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  const first = px(cities[order[0]], canvas);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < order.length; i++) {
    const p = px(cities[order[i]], canvas);
    ctx.lineTo(p.x, p.y);
  }
  if (closed) ctx.lineTo(first.x, first.y);
  ctx.stroke();
}

/**
 * Draw an explicit route that already includes the return to start.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {HTMLCanvasElement} canvas - Canvas owning the context.
 * @param {Array<{x: number, y: number}>} cities - City positions.
 * @param {number[]} route - City indices, e.g. [0, 2, 1, 0].
 * @param {{color?: string, width?: number}} [options] - Styling.
 * @returns {void}
 */
export function drawRoute(ctx, canvas, cities, route, { color = "#4f9dff", width = 2 } = {}) {
  if (route.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  const first = px(cities[route[0]], canvas);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < route.length; i++) {
    const p = px(cities[route[i]], canvas);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}
