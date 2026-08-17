const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function drawPixel(png, x, y, r, g, b, a = 255) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function drawLine(png, x0, y0, x1, y1, r, g, b, thickness = 1) {
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  x1 = Math.floor(x1); y1 = Math.floor(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const half = Math.floor(thickness / 2);
  while (true) {
    for (let tx = -half; tx <= half; tx++) {
      for (let ty = -half; ty <= half; ty++) {
        drawPixel(png, x0 + tx, y0 + ty, r, g, b);
      }
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function drawCircle(png, cx, cy, radius, r, g, b, thickness = 1) {
  cx = Math.floor(cx); cy = Math.floor(cy);
  for (let angle = 0; angle < 360; angle += 0.5) {
    const rad = (angle * Math.PI) / 180;
    const x = cx + Math.cos(rad) * radius;
    const y = cy + Math.sin(rad) * radius;
    drawPixel(png, x, y, r, g, b);
    if (thickness > 1) {
      drawPixel(png, x + 1, y, r, g, b);
      drawPixel(png, x, y + 1, r, g, b);
    }
  }
}

function filledCircle(png, cx, cy, radius, r, g, b) {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius) {
        drawPixel(png, cx + x, cy + y, r, g, b);
      }
    }
  }
}

function generateCrosshair(type, size = 64) {
  const png = new PNG({ width: size, height: size });
  const c = size / 2;

  switch (type) {
    case 'classic':
      // White arrow cursor
      for (let i = 0; i < 10; i++) {
        drawLine(png, 3, 3 + i, 3 + i * 2, 3 + i, 255, 255, 255, 2);
      }
      drawLine(png, 12, 14, 16, 22, 255, 255, 255, 2);
      drawLine(png, 15, 15, 22, 16, 255, 255, 255, 2);
      break;

    case 'dot':
      filledCircle(png, c, c, 3, 255, 255, 255);
      break;

    case 'small-cross':
      drawLine(png, c, c - 6, c, c - 2, 255, 255, 255, 1);
      drawLine(png, c, c + 2, c, c + 6, 255, 255, 255, 1);
      drawLine(png, c - 6, c, c - 2, c, 255, 255, 255, 1);
      drawLine(png, c + 2, c, c + 6, c, 255, 255, 255, 1);
      break;

    case 'minimal':
      drawLine(png, c - 5, c, c + 5, c, 220, 220, 220, 1);
      drawLine(png, c, c - 5, c, c + 5, 220, 220, 220, 1);
      drawPixel(png, c, c, 255, 60, 60);
      break;

    case 'circle':
      drawCircle(png, c, c, 12, 255, 255, 255, 1);
      drawPixel(png, c, c, 255, 60, 60);
      break;

    case 'hollow-circle':
      drawCircle(png, c, c, 14, 200, 200, 200, 1);
      break;

    case 'thin-cross':
      drawLine(png, c, c - 16, c, c - 3, 255, 255, 255, 1);
      drawLine(png, c, c + 3, c, c + 16, 255, 255, 255, 1);
      drawLine(png, c - 16, c, c - 3, c, 255, 255, 255, 1);
      drawLine(png, c + 3, c, c + 16, c, 255, 255, 255, 1);
      break;

    case 'thick-cross':
      drawLine(png, c, c - 16, c, c - 3, 255, 255, 255, 3);
      drawLine(png, c, c + 3, c, c + 16, 255, 255, 255, 3);
      drawLine(png, c - 16, c, c - 3, c, 255, 255, 255, 3);
      drawLine(png, c + 3, c, c + 16, c, 255, 255, 255, 3);
      break;

    case 'rgb':
      drawLine(png, c, c - 14, c, c - 2, 255, 50, 50, 2);
      drawLine(png, c, c + 2, c, c + 14, 50, 50, 255, 2);
      drawLine(png, c - 14, c, c - 2, c, 50, 255, 50, 2);
      drawLine(png, c + 2, c, c + 14, c, 255, 255, 50, 2);
      filledCircle(png, c, c, 2, 255, 255, 255);
      break;

    case 'clean':
      drawLine(png, c - 10, c, c + 10, c, 255, 255, 255, 1);
      drawLine(png, c, c - 10, c, c + 10, 255, 255, 255, 1);
      break;

    case 'competitive':
      drawLine(png, c, c - 12, c, c - 3, 0, 255, 100, 2);
      drawLine(png, c, c + 3, c, c + 12, 0, 255, 100, 2);
      drawLine(png, c - 12, c, c - 3, c, 0, 255, 100, 2);
      drawLine(png, c + 3, c, c + 12, c, 0, 255, 100, 2);
      filledCircle(png, c, c, 2, 0, 255, 100);
      break;

    case 'valorant-style':
      drawLine(png, c, c - 14, c, c - 4, 255, 70, 70, 2);
      drawLine(png, c, c + 4, c, c + 14, 255, 70, 70, 2);
      drawLine(png, c - 14, c, c - 4, c, 255, 70, 70, 2);
      drawLine(png, c + 4, c, c + 14, c, 255, 70, 70, 2);
      break;

    case 'cs-style':
      drawLine(png, c, c - 12, c, c - 3, 0, 200, 255, 2);
      drawLine(png, c, c + 3, c, c + 12, 0, 200, 255, 2);
      drawLine(png, c - 12, c, c - 3, c, 0, 200, 255, 2);
      drawLine(png, c + 3, c, c + 12, c, 0, 200, 255, 2);
      break;
  }

  return png;
}

const crosshairs = [
  'classic', 'dot', 'small-cross', 'minimal', 'circle',
  'hollow-circle', 'thin-cross', 'thick-cross', 'rgb',
  'clean', 'competitive', 'valorant-style', 'cs-style'
];

const outDir = path.join(__dirname, 'public', 'crosshairs');
fs.mkdirSync(outDir, { recursive: true });

for (const name of crosshairs) {
  const png = generateCrosshair(name);
  const buf = PNG.sync.write(png);
  fs.writeFileSync(path.join(outDir, `${name}.png`), buf);
  console.log(`Generated: ${name}.png`);
}

console.log('All crosshairs generated!');
