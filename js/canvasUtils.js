// Shared drawing helpers for city points and tours on a <canvas>.
// City coordinates are normalized [0,1]; every helper scales by the target
// canvas's own width/height so one city set renders correctly on any canvas.

export function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function px(c, canvas) {
  return { x: c.x * canvas.width, y: c.y * canvas.height };
}

export function drawCities(ctx, canvas, cities, { radius = 5, color = "#e6e9f0", labels = true } = {}) {
  cities.forEach((c, i) => {
    const p = px(c, canvas);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (labels) {
      ctx.fillStyle = "#8a92a8";
      ctx.font = "11px monospace";
      ctx.fillText(String(i), p.x + radius + 2, p.y - radius);
    }
  });
}

export function drawCompleteGraph(ctx, canvas, cities, { color = "rgba(79,157,255,0.12)", showDistances = false, distMatrix = null } = {}) {
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

      if (showDistances && distMatrix) {
        const dist = Math.round(distMatrix[i][j] * 1000);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        ctx.fillStyle = "rgba(79,157,255,0.6)";
        ctx.font = "10px monospace";
        ctx.fillText(String(dist), midX + 2, midY - 2);
      }
    }
  }
}

// order: array of city indices forming a closed tour (last connects back to first).
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

// route: array of city indices already including the return to start (open path).
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
