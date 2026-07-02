// Minimal canvas line chart for best/avg fitness over generations. No libraries.

export function drawFitnessChart(ctx, canvas, bestHistory, avgHistory) {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 16, right: 12, bottom: 24, left: 46 };
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

  ctx.fillStyle = "#8a92a8";
  ctx.font = "10px monospace";
  ctx.fillText(maxVal.toFixed(0), 2, padding.top + 4);
  ctx.fillText(minVal.toFixed(0), 2, padding.top + plotH);
  ctx.fillText(`gen ${bestHistory.length - 1}`, padding.left + plotW - 40, height - 6);

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

  drawLine(avgHistory, "#ff8a4f");
  drawLine(bestHistory, "#4fd984");

  ctx.fillStyle = "#4fd984";
  ctx.fillText("best", padding.left + 4, padding.top + 10);
  ctx.fillStyle = "#ff8a4f";
  ctx.fillText("avg", padding.left + 34, padding.top + 10);
}
