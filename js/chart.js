// Minimal canvas line chart for best/avg fitness over generations. No libraries.

export function drawFitnessChart(ctx, canvas, bestHistory, avgHistory) {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 20, right: 18, bottom: 46, left: 66 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  if (bestHistory.length < 2) {
    ctx.fillStyle = "#8a92a8";
    ctx.font = "12px monospace";
    ctx.fillText("Fitness chart will appear once the GA is running.", padding.left, height / 2);
    return;
  }

  const allValues = bestHistory.concat(avgHistory);
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const range = maxVal - minVal || 1;

  const xForIndex = (i) => padding.left + (i / (bestHistory.length - 1)) * plotW;
  const yForValue = (v) => padding.top + (1 - (v - minVal) / range) * plotH;

  // Axes
  ctx.strokeStyle = "#2a3348";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + plotH);
  ctx.lineTo(padding.left + plotW, padding.top + plotH);
  ctx.stroke();

  // Distance shown in the same ×1000 units as the stat cards.
  const scaled = (v) => Math.round(v * 1000).toLocaleString();

  // Y-axis top tick (max). The bottom tick is the marked best value (drawn below).
  ctx.fillStyle = "#8a92a8";
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(scaled(maxVal), padding.left - 8, padding.top);

  // X-axis start tick. The best generation is marked below.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("0", padding.left, padding.top + plotH + 14);

  // Axis titles
  ctx.fillStyle = "#e6e9f0";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Generation", padding.left + plotW / 2, height - 6);

  ctx.save();
  ctx.translate(14, padding.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Distance", 0, 0);
  ctx.restore();

  const drawLine = (data, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = xForIndex(i);
      const y = yForValue(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  // Plot the average line only; the best is marked, not plotted.
  drawLine(avgHistory, "#ff8a4f");

  // Find the best (minimum) point and mark its X (generation) and Y (distance).
  let bestIdx = 0;
  for (let i = 1; i < bestHistory.length; i++) {
    if (bestHistory[i] < bestHistory[bestIdx]) bestIdx = i;
  }
  const bestVal = bestHistory[bestIdx];
  const bx = xForIndex(bestIdx);
  const by = yForValue(bestVal);

  // Dashed guide lines: a full-height column marks the best generation (X),
  // a level line marks the best distance (Y).
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(79,217,132,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx, padding.top);
  ctx.lineTo(bx, padding.top + plotH);
  ctx.moveTo(padding.left, by);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.restore();

  // Marker dot at the best point.
  ctx.fillStyle = "#4fd984";
  ctx.beginPath();
  ctx.arc(bx, by, 4, 0, Math.PI * 2);
  ctx.fill();

  // Coordinate labels for the marked best (green).
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(bestIdx), bx, padding.top + plotH + 14); // best generation on X
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(scaled(bestVal), padding.left - 8, by);         // best distance on Y

  // Legend
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#4fd984";
  ctx.beginPath();
  ctx.arc(padding.left + 9, padding.top + 7, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillText("best", padding.left + 16, padding.top + 10);
  ctx.fillStyle = "#ff8a4f";
  ctx.fillText("avg", padding.left + 48, padding.top + 10);
}
