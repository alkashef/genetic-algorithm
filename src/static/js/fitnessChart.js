/**
 * @module fitnessChart
 * @description Minimal canvas line chart of fitness (tour distance) per
 * generation: the population average, on a gridded plot area. No chart
 * libraries.
 */

import { formatDistance } from "./format.js";

const Y_TICK_COUNT = 4; // 5 labels, including both ends
const X_TICK_COUNT = 6; // up to 7 labels, including both ends

/**
 * Draw the full fitness chart, or a placeholder message when there is not
 * yet enough history.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {HTMLCanvasElement} canvas - Canvas owning the context.
 * @param {number[]} avgHistory - Average fitness (tour distance) per generation.
 * @returns {void}
 */
export function drawFitnessChart(ctx, canvas, avgHistory) {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const padding = { top: 16, right: 16, bottom: 40, left: 60 };
  const plot = {
    w: width - padding.left - padding.right,
    h: height - padding.top - padding.bottom,
  };
  drawPlotBackground(ctx, padding, plot);
  if (avgHistory.length < 2) {
    drawPlaceholder(ctx, padding, height);
    return;
  }
  const scale = makeScale(avgHistory, padding, plot);
  drawGrid(ctx, scale, padding, plot);
  drawAxes(ctx, padding, plot);
  drawTickLabels(ctx, scale, padding, plot);
  drawAxisTitles(ctx, padding, plot, width, height);
  drawSeries(ctx, avgHistory, scale, "#e2692a");
  drawLegend(ctx, padding);
}

/**
 * Fill the plot area with a light-grey background.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {{top: number, left: number}} padding - Plot padding.
 * @param {{w: number, h: number}} plot - Plot dimensions.
 * @returns {void}
 */
function drawPlotBackground(ctx, padding, plot) {
  ctx.fillStyle = "#eef1f6";
  ctx.fillRect(padding.left, padding.top, plot.w, plot.h);
}

/**
 * Show the pre-run placeholder message.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {{left: number}} padding - Plot padding.
 * @param {number} height - Canvas height.
 * @returns {void}
 */
function drawPlaceholder(ctx, padding, height) {
  ctx.fillStyle = "#667085";
  ctx.font = "12px monospace";
  ctx.fillText("Fitness chart will appear once the GA is running.", padding.left + 10, height / 2);
}

/**
 * Build the value→pixel mapping for both axes, plus the tick positions to
 * draw as gridlines and labels.
 *
 * @param {number[]} avgHistory - Average fitness per generation.
 * @param {{top: number, left: number}} padding - Plot padding.
 * @param {{w: number, h: number}} plot - Plot dimensions.
 * @returns {{x: (i: number) => number, y: (v: number) => number,
 *   yTicks: number[], xTicks: number[]}} Scale functions and tick positions.
 */
function makeScale(avgHistory, padding, plot) {
  const maxVal = Math.max(...avgHistory);
  const minVal = Math.min(...avgHistory);
  const range = maxVal - minVal || 1;
  const n = avgHistory.length;

  const yTicks = [];
  for (let i = 0; i <= Y_TICK_COUNT; i++) {
    yTicks.push(minVal + (range * i) / Y_TICK_COUNT);
  }

  const xTickCount = Math.min(X_TICK_COUNT, n - 1);
  const xTicks = [];
  for (let i = 0; i <= xTickCount; i++) {
    xTicks.push(Math.round((i / xTickCount) * (n - 1)));
  }

  return {
    x: (i) => padding.left + (i / (n - 1)) * plot.w,
    y: (v) => padding.top + (1 - (v - minVal) / range) * plot.h,
    yTicks,
    xTicks,
  };
}

/**
 * Draw the white gridline mesh at every tick position.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {{x: Function, y: Function, yTicks: number[], xTicks: number[]}} scale - Value scale.
 * @param {{top: number, left: number}} padding - Plot padding.
 * @param {{w: number, h: number}} plot - Plot dimensions.
 * @returns {void}
 */
function drawGrid(ctx, scale, padding, plot) {
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (const v of scale.yTicks) {
    const y = Math.round(scale.y(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plot.w, y);
    ctx.stroke();
  }
  for (const idx of scale.xTicks) {
    const x = Math.round(scale.x(idx)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plot.h);
    ctx.stroke();
  }
}

/**
 * Draw the X and Y axis lines.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {{top: number, left: number}} padding - Plot padding.
 * @param {{w: number, h: number}} plot - Plot dimensions.
 * @returns {void}
 */
function drawAxes(ctx, padding, plot) {
  ctx.strokeStyle = "#2a3348";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + plot.h);
  ctx.lineTo(padding.left + plot.w, padding.top + plot.h);
  ctx.stroke();
}

/**
 * Draw the numeric tick labels along both axes.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {{x: Function, y: Function, yTicks: number[], xTicks: number[]}} scale - Value scale.
 * @param {{top: number, left: number}} padding - Plot padding.
 * @param {{w: number, h: number}} plot - Plot dimensions.
 * @returns {void}
 */
function drawTickLabels(ctx, scale, padding, plot) {
  ctx.fillStyle = "#667085";
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const v of scale.yTicks) {
    ctx.fillText(formatDistance(v), padding.left - 8, scale.y(v));
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const idx of scale.xTicks) {
    ctx.fillText(String(idx), scale.x(idx), padding.top + plot.h + 14);
  }
}

/**
 * Draw the X and Y axis titles.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {{top: number, left: number}} padding - Plot padding.
 * @param {{w: number, h: number}} plot - Plot dimensions.
 * @param {number} width - Canvas width.
 * @param {number} height - Canvas height.
 * @returns {void}
 */
function drawAxisTitles(ctx, padding, plot, width, height) {
  ctx.fillStyle = "#1a2235";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Generation", padding.left + plot.w / 2, height - 6);
  ctx.save();
  ctx.translate(14, padding.top + plot.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Fitness", 0, 0);
  ctx.restore();
}

/**
 * Plot one data series as a polyline.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {number[]} data - Series values per generation.
 * @param {{x: Function, y: Function}} scale - Value scale.
 * @param {string} color - Stroke color.
 * @returns {void}
 */
function drawSeries(ctx, data, scale, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((v, i) => {
    if (i === 0) ctx.moveTo(scale.x(i), scale.y(v));
    else ctx.lineTo(scale.x(i), scale.y(v));
  });
  ctx.stroke();
}

/**
 * Draw the avg-series legend in the top-left corner of the plot.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {{top: number, left: number}} padding - Plot padding.
 * @returns {void}
 */
function drawLegend(ctx, padding) {
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e2692a";
  ctx.beginPath();
  ctx.arc(padding.left + 9, padding.top + 7, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillText("avg", padding.left + 16, padding.top + 10);
}
