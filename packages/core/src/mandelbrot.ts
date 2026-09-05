import type { MandelbrotPalette, MandelbrotParameters } from "../../contracts/src/index.js";
import { MANDELBROT_LIMITS } from "../../contracts/src/index.js";
import { AppError } from "./errors.js";

const SVG_HEADER_BYTES_ESTIMATE = 512;

function paletteColor(iteration: number, maxIterations: number, palette: MandelbrotPalette): string {
  if (iteration >= maxIterations) return "#07111f";
  const ratio = iteration / maxIterations;
  if (palette === "MONO") {
    const shade = Math.floor(40 + ratio * 215);
    return `rgb(${shade} ${shade} ${shade})`;
  }
  if (palette === "EMBER") {
    const red = Math.floor(90 + ratio * 165);
    const green = Math.floor(20 + ratio * 110);
    return `rgb(${red} ${green} 30)`;
  }
  const blue = Math.floor(100 + ratio * 155);
  const green = Math.floor(40 + ratio * 180);
  return `rgb(20 ${green} ${blue})`;
}

export function renderMandelbrotSvg(parameters: MandelbrotParameters): string {
  const { width, height, maxIterations, centerX, centerY, zoom, palette } = parameters;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    !Number.isInteger(maxIterations) ||
    width < MANDELBROT_LIMITS.MIN_WIDTH ||
    width > MANDELBROT_LIMITS.MAX_WIDTH ||
    height < MANDELBROT_LIMITS.MIN_HEIGHT ||
    height > MANDELBROT_LIMITS.MAX_HEIGHT ||
    maxIterations < MANDELBROT_LIMITS.MIN_ITERATIONS ||
    maxIterations > MANDELBROT_LIMITS.MAX_ITERATIONS ||
    !Number.isFinite(centerX) ||
    !Number.isFinite(centerY) ||
    !Number.isFinite(zoom) ||
    zoom <= 0
  ) {
    throw new AppError(422, "INVALID_WORKLOAD", "Mandelbrot workload parameters are outside safe limits");
  }

  const sampleStep = Math.max(1, Math.ceil(Math.sqrt((width * height) / 180_000)));
  const rectangles: string[] = [];
  for (let pixelY = 0; pixelY < height; pixelY += sampleStep) {
    const imaginary = centerY + ((pixelY / height) * 3 - 1.5) / zoom;
    let runColor = "";
    let runStart = 0;
    for (let pixelX = 0; pixelX < width; pixelX += sampleStep) {
      const real = centerX + ((pixelX / width) * 3.5 - 1.75) / zoom;
      let x = 0;
      let y = 0;
      let iteration = 0;
      while (x * x + y * y <= 4 && iteration < maxIterations) {
        const nextX = x * x - y * y + real;
        y = 2 * x * y + imaginary;
        x = nextX;
        iteration += 1;
      }
      const color = paletteColor(iteration, maxIterations, palette);
      if (runColor !== "" && color !== runColor) {
        rectangles.push(
          `<rect x="${runStart}" y="${pixelY}" width="${pixelX - runStart}" height="${sampleStep}" fill="${runColor}"/>`
        );
        runStart = pixelX;
      }
      runColor = color;
    }
    if (runColor !== "") {
      rectangles.push(
        `<rect x="${runStart}" y="${pixelY}" width="${width - runStart}" height="${sampleStep}" fill="${runColor}"/>`
      );
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#07111f"/>${rectangles.join("")}</svg>`;
  if (Buffer.byteLength(svg, "utf8") + SVG_HEADER_BYTES_ESTIMATE > MANDELBROT_LIMITS.MAX_RESULT_BYTES) {
    throw new AppError(413, "RESULT_TOO_LARGE", "Rendered result exceeds the configured output limit");
  }
  return svg;
}
