/**
 * @module fitnessChart
 * @description Minimal canvas line chart of average tour distance per
 * generation. No chart libraries.
 */

import { formatDistance } from "./format.js";

/**
 * Draw the full fitness chart, or a placeholder message when there is not
 * yet enough history.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {HTMLCanvasElement} canvas - Canvas owning the context.
 * @param {number[]} avgHistory - Average distance per generation.
 * @returns {void}
 */
export function drawFitnessChart(ctx, canvas, avgHistory) {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const padding = { top: 20, right: 18, bottom: 46, left: 66 };
  const plot = {
    w: width - padding.left - padding.right,
    h: height - padding.top - padding.bottom,
  };
  if (avgHistory.length < 2) {
    drawPlaceholder(ctx, padding, height);
    return;
  }
  const scale = makeScale(avgHistory, padding, plot);
  drawAxes(ctx, padding, plot);
  drawTicksAndTitles(ctx, scale, padding, plot, width, height);
  drawSeries(ctx, avgHistory, scale, "#e2692a");
  drawLegend(ctx, padding);
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
  ctx.fillText("Fitness chart will appear once the GA is running.", padding.left, height / 2);
}

/**
 * Build the value→pixel mapping for both axes.
 *
 * @param {number[]} avgHistory - Average distance per generation.
 * @param {{top: number, left: number}} padding - Plot padding.
 * @param {{w: number, h: number}} plot - Plot dimensions.
 * @returns {{x: (i: number) => number, y: (v: number) => number, maxVal: number}} Scale functions.
 */
function makeScale(avgHistory, padding, plot) {
  const maxVal = Math.max(...avgHistory);
  const minVal = Math.min(...avgHistory);
  const range = maxVal - minVal || 1;
  return {
    x: (i) => padding.left + (i / (avgHistory.length - 1)) * plot.w,
    y: (v) => padding.top + (1 - (v - minVal) / range) * plot.h,
    maxVal,
  };
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
 * Draw the boundary tick labels and the axis titles.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context.
 * @param {{maxVal: number}} scale - Value scale.
 * @param {{top: number, left: number}} padding - Plot padding.
 * @param {{w: number, h: number}} plot - Plot dimensions.
 * @param {number} width - Canvas width.
 * @param {number} height - Canvas height.
 * @returns {void}
 */
function drawTicksAndTitles(ctx, scale, padding, plot, width, height) {
  ctx.fillStyle = "#667085";
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(formatDistance(scale.maxVal), padding.left - 8, padding.top);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("0", padding.left, padding.top + plot.h + 14);
  ctx.fillStyle = "#1a2235";
  ctx.font = "11px sans-serif";
  ctx.fillText("Generation", padding.left + plot.w / 2, height - 6);
  ctx.save();
  ctx.translate(14, padding.top + plot.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Distance", 0, 0);
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
