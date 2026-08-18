import { useState, useRef, useEffect, useCallback } from "react";
import {
  Pencil,
  Eraser,
  PaintBucket,
  Trash2,
  Undo2,
  Redo2,
  Grid3x3,
  Download,
  Pipette,
  Minus,
  Square,
  Circle,
  MousePointer2,
  Move,
} from "lucide-react";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import * as api from "../../lib/tauri";

const CANVAS_SIZE = 64;
const DISPLAY_SCALE = 8;
const DISPLAY_SIZE = CANVAS_SIZE * DISPLAY_SCALE;

type Tool =
  | "pencil"
  | "eraser"
  | "fill"
  | "eyedropper"
  | "line"
  | "rect"
  | "rectFilled"
  | "circle"
  | "circleFilled"
  | "move";

const PRESET_COLORS = [
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff",
  "#ffff00", "#ff00ff", "#00ffff", "#ff8800", "#8800ff",
  "#ff0088", "#00ff88", "#888888", "#444444", "#ff4444",
  "#44ff44", "#4444ff", "#ffaa00", "#aa00ff", "#00aaff",
];

function hexToRgb(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
}

export function CursorEditor() {
  const { addToast } = useUIStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const brushSizeRef = useRef(brushSize);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  const cursorRef = useRef<HTMLDivElement>(null);
  const shapeSvgRef = useRef<SVGSVGElement>(null);

  const drawing = useRef(false);
  const lastPixel = useRef<{ x: number; y: number } | null>(null);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const mousePos = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef(0);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    pushHistory(imageData);
  }, []);

  useEffect(() => { initCanvas(); }, [initCanvas]);

  const pushHistory = (imageData: ImageData) => {
    const idx = historyIndexRef.current;
    setHistory((prev) => {
      const next = prev.slice(0, idx + 1);
      next.push(imageData);
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  };

  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    const newIdx = historyIndexRef.current - 1;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(historyRef.current[newIdx], 0, 0);
    setHistoryIndex(newIdx);
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const newIdx = historyIndexRef.current + 1;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(historyRef.current[newIdx], 0, 0);
    setHistoryIndex(newIdx);
  };

  const getPixel = (e: React.MouseEvent | MouseEvent): { x: number; y: number } | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) * (CANVAS_SIZE / r.width));
    const y = Math.floor((e.clientY - r.top) * (CANVAS_SIZE / r.height));
    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return null;
    return { x, y };
  };

  const getSubPixel = (e: React.MouseEvent | MouseEvent): { x: number; y: number } | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) * (CANVAS_SIZE / r.width);
    const y = (e.clientY - r.top) * (CANVAS_SIZE / r.height);
    if (x < -0.5 || x > CANVAS_SIZE + 0.5 || y < -0.5 || y > CANVAS_SIZE + 0.5) return null;
    return { x, y };
  };

  const getPixelColor = (ctx: CanvasRenderingContext2D, x: number, y: number): string => {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return `#${d[0].toString(16).padStart(2, "0")}${d[1].toString(16).padStart(2, "0")}${d[2].toString(16).padStart(2, "0")}${d[3].toString(16).padStart(2, "0")}`;
  };

  const prepareColor = (c: string) => {
    if (c === "eraser") return null;
    const [r, g, b, a] = hexToRgb(c);
    return `rgba(${r},${g},${b},${a / 255})`;
  };

  const setPixel = (ctx: CanvasRenderingContext2D, x: number, y: number, colorStr: string | null) => {
    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return;
    if (!colorStr) {
      ctx.clearRect(x, y, 1, 1);
    } else {
      ctx.fillStyle = colorStr;
      ctx.fillRect(x, y, 1, 1);
    }
  };

  const drawBrushPixel = (ctx: CanvasRenderingContext2D, x: number, y: number, colorStr: string | null) => {
    const half = Math.floor(brushSizeRef.current / 2);
    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        setPixel(ctx, x + dx, y + dy, colorStr);
      }
    }
  };

  const drawBresenhamLine = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void) => {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      fn(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  const drawLinePixels = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, colorStr: string | null) => {
    drawBresenhamLine(ctx, x0, y0, x1, y1, (x, y) => setPixel(ctx, x, y, colorStr));
  };

  const drawRectPixels = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, colorStr: string | null, filled: boolean) => {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    if (filled) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          setPixel(ctx, x, y, colorStr);
        }
      }
    } else {
      for (let x = minX; x <= maxX; x++) {
        setPixel(ctx, x, minY, colorStr);
        setPixel(ctx, x, maxY, colorStr);
      }
      for (let y = minY + 1; y < maxY; y++) {
        setPixel(ctx, minX, y, colorStr);
        setPixel(ctx, maxX, y, colorStr);
      }
    }
  };

  const drawEllipsePixels = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, colorStr: string | null, filled: boolean) => {
    const cx = Math.round((x0 + x1) / 2);
    const cy = Math.round((y0 + y1) / 2);
    let a = Math.round(Math.abs(x1 - x0) / 2);
    let b = Math.round(Math.abs(y1 - y0) / 2);

    if (a === 0 && b === 0) { setPixel(ctx, cx, cy, colorStr); return; }
    if (a === 0) {
      for (let y = cy - b; y <= cy + b; y++) setPixel(ctx, cx, y, colorStr);
      return;
    }
    if (b === 0) {
      for (let x = cx - a; x <= cx + a; x++) setPixel(ctx, x, cy, colorStr);
      return;
    }

    const aSq = a * a, bSq = b * b;
    let dx = 0, dy = b;
    let d1 = bSq - aSq * b + 0.25 * aSq;

    const plotEllipse = (px: number, py: number) => {
      if (filled) {
        for (let x = cx - px; x <= cx + px; x++) {
          setPixel(ctx, x, py, colorStr);
        }
      } else {
        setPixel(ctx, cx + px, py, colorStr);
        setPixel(ctx, cx - px, py, colorStr);
      }
    };

    const plot4 = (px: number, py: number) => {
      if (filled) {
        for (let x = cx - px; x <= cx + px; x++) {
          setPixel(ctx, x, cy + py, colorStr);
          setPixel(ctx, x, cy - py, colorStr);
        }
      } else {
        setPixel(ctx, cx + px, cy + py, colorStr);
        setPixel(ctx, cx - px, cy + py, colorStr);
        setPixel(ctx, cx + px, cy - py, colorStr);
        setPixel(ctx, cx - px, cy - py, colorStr);
      }
    };

    while (dx * bSq < dy * aSq) {
      plot4(dx, dy);
      dx++;
      if (d1 < 0) {
        d1 += bSq * (2 * dx + 1);
      } else {
        dy--;
        d1 += bSq * (2 * dx + 1) - aSq * (2 * dy - 1);
      }
    }

    let d2 = bSq * (dx + 0.5) * (dx + 0.5) + aSq * (dy - 1) * (dy - 1) - aSq * bSq;
    while (dy >= 0) {
      plot4(dx, dy);
      dy--;
      if (d2 > 0) {
        d2 += aSq * (1 - 2 * dy);
      } else {
        dx++;
        d2 += bSq * (2 * dx + 1) + aSq * (1 - 2 * dy);
      }
    }
  };

  const floodFill = (ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: string) => {
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const data = imageData.data;
    const startIdx = (startY * CANVAS_SIZE + startX) * 4;
    const sR = data[startIdx], sG = data[startIdx + 1], sB = data[startIdx + 2], sA = data[startIdx + 3];
    const [fR, fG, fB, fA] = hexToRgb(fillColor);
    if (sR === fR && sG === fG && sB === fB && sA === fA) return;

    const stack: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) continue;
      const key = y * CANVAS_SIZE + x;
      if (visited[key]) continue;
      const idx = key * 4;
      if (data[idx] !== sR || data[idx + 1] !== sG || data[idx + 2] !== sB || data[idx + 3] !== sA) continue;

      visited[key] = 1;
      data[idx] = fR;
      data[idx + 1] = fG;
      data[idx + 2] = fB;
      data[idx + 3] = fA;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const getShapeColorStr = () => prepareColor(toolRef.current === "eraser" ? "eraser" : colorRef.current);

  const commitShape = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const c = getShapeColorStr();
    const t = toolRef.current;
    if (t === "line") drawLinePixels(ctx, start.x, start.y, end.x, end.y, c);
    else if (t === "rect") drawRectPixels(ctx, start.x, start.y, end.x, end.y, c, false);
    else if (t === "rectFilled") drawRectPixels(ctx, start.x, start.y, end.x, end.y, c, true);
    else if (t === "circle") drawEllipsePixels(ctx, start.x, start.y, end.x, end.y, c, false);
    else if (t === "circleFilled") drawEllipsePixels(ctx, start.x, start.y, end.x, end.y, c, true);
    pushHistory(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE));
  };

  const movePixels = (ctx: CanvasRenderingContext2D, dx: number, dy: number) => {
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const src = new Uint8ClampedArray(imageData.data);
    const data = imageData.data;
    data.fill(0);
    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        const sx = x - dx, sy = y - dy;
        if (sx >= 0 && sx < CANVAS_SIZE && sy >= 0 && sy < CANVAS_SIZE) {
          const si = (sy * CANVAS_SIZE + sx) * 4;
          const di = (y * CANVAS_SIZE + x) * 4;
          data[di] = src[si];
          data[di + 1] = src[si + 1];
          data[di + 2] = src[si + 2];
          data[di + 3] = src[si + 3];
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const isShapeTool = (t: Tool) => t === "line" || t === "rect" || t === "rectFilled" || t === "circle" || t === "circleFilled";

  const updateCursorDOM = (sp: { x: number; y: number } | null, tool: Tool, bs: number) => {
    const el = cursorRef.current;
    if (!el) return;
    if (!sp) { el.style.display = "none"; return; }
    el.style.display = "block";

    if (tool === "eyedropper") {
      el.className = "absolute pointer-events-none w-5 h-5 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2";
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.left = (sp.x * DISPLAY_SCALE + DISPLAY_SCALE / 2) + "px";
      el.style.top = (sp.y * DISPLAY_SCALE + DISPLAY_SCALE / 2) + "px";
      el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.5)";
      el.style.border = "2px solid white";
      el.style.borderRadius = "50%";
      el.style.background = "transparent";
    } else if (tool === "move") {
      el.className = "absolute pointer-events-none";
      el.style.width = DISPLAY_SIZE + "px";
      el.style.height = DISPLAY_SIZE + "px";
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.border = "1px dashed rgba(255,255,255,0.4)";
      el.style.borderRadius = "0";
      el.style.boxShadow = "none";
      el.style.background = "transparent";
    } else if (isShapeTool(tool)) {
      el.style.width = "6px";
      el.style.height = "6px";
      el.style.left = (sp.x * DISPLAY_SCALE + DISPLAY_SCALE / 2 - 3) + "px";
      el.style.top = (sp.y * DISPLAY_SCALE + DISPLAY_SCALE / 2 - 3) + "px";
      el.style.border = "2px solid white";
      el.style.borderRadius = "50%";
      el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.5)";
      el.style.background = "transparent";
    } else {
      const size = bs * DISPLAY_SCALE;
      el.className = "absolute pointer-events-none";
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = (sp.x * DISPLAY_SCALE + DISPLAY_SCALE / 2 - size / 2) + "px";
      el.style.top = (sp.y * DISPLAY_SCALE + DISPLAY_SCALE / 2 - size / 2) + "px";
      el.style.border = "1px solid rgba(255,255,255,0.7)";
      el.style.borderRadius = "0";
      el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.5)";
      el.style.background = "transparent";
    }
  };

  const updateShapeDOM = (s: { x: number; y: number } | null, e: { x: number; y: number } | null, tool: Tool) => {
    const svg = shapeSvgRef.current;
    if (!svg) return;
    if (!s || !e || !isShapeTool(tool)) { svg.style.display = "none"; return; }
    svg.style.display = "block";

    const line = svg.querySelector<SVGLineElement>("#sh-line");
    const rect = svg.querySelector<SVGRectElement>("#sh-rect");
    const ellipse = svg.querySelector<SVGEllipseElement>("#sh-ellipse");
    if (line) line.style.display = tool === "line" ? "" : "none";
    if (rect) rect.style.display = (tool === "rect" || tool === "rectFilled") ? "" : "none";
    if (ellipse) ellipse.style.display = (tool === "circle" || tool === "circleFilled") ? "" : "none";

    if (tool === "line" && line) {
      line.setAttribute("x1", String(s.x * DISPLAY_SCALE + DISPLAY_SCALE / 2));
      line.setAttribute("y1", String(s.y * DISPLAY_SCALE + DISPLAY_SCALE / 2));
      line.setAttribute("x2", String(e.x * DISPLAY_SCALE + DISPLAY_SCALE / 2));
      line.setAttribute("y2", String(e.y * DISPLAY_SCALE + DISPLAY_SCALE / 2));
    } else if ((tool === "rect" || tool === "rectFilled") && rect) {
      const minX = Math.min(s.x, e.x), maxX = Math.max(s.x, e.x);
      const minY = Math.min(s.y, e.y), maxY = Math.max(s.y, e.y);
      rect.setAttribute("x", String(minX * DISPLAY_SCALE));
      rect.setAttribute("y", String(minY * DISPLAY_SCALE));
      rect.setAttribute("width", String((maxX - minX + 1) * DISPLAY_SCALE));
      rect.setAttribute("height", String((maxY - minY + 1) * DISPLAY_SCALE));
      rect.setAttribute("fill", tool === "rectFilled" ? "rgba(255,255,255,0.15)" : "none");
    } else if ((tool === "circle" || tool === "circleFilled") && ellipse) {
      const cx = (s.x + e.x) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2;
      const cy = (s.y + e.y) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2;
      const rx = Math.abs(e.x - s.x) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2;
      const ry = Math.abs(e.y - s.y) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2;
      ellipse.setAttribute("cx", String(cx));
      ellipse.setAttribute("cy", String(cy));
      ellipse.setAttribute("rx", String(rx));
      ellipse.setAttribute("ry", String(ry));
      ellipse.setAttribute("fill", tool === "circleFilled" ? "rgba(255,255,255,0.15)" : "none");
    }
  };

  const rafUpdate = () => {
    const p = mousePos.current;
    updateCursorDOM(p, toolRef.current, brushSizeRef.current);
    rafId.current = 0;
  };

  const scheduleCursorUpdate = () => {
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(rafUpdate);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getPixel(e);
    if (!p) return;
    const t = toolRef.current;

    if (t === "eyedropper") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const c = getPixelColor(ctx, p.x, p.y);
      if (c.endsWith("00")) return;
      setColor(c);
      setTool("pencil");
      return;
    }

    if (t === "fill") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      floodFill(ctx, p.x, p.y, colorRef.current);
      pushHistory(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE));
      return;
    }

    if (t === "move") {
      drawing.current = true;
      shapeStart.current = p;
      return;
    }

    if (isShapeTool(t)) {
      drawing.current = true;
      shapeStart.current = p;
      return;
    }

    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const c = (toolRef.current === "eraser") ? null : prepareColor(colorRef.current);
    const prev = lastPixel.current;
    if (prev) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i++) {
        const tt = steps === 0 ? 0 : i / steps;
        drawBrushPixel(ctx, Math.round(prev.x + dx * tt), Math.round(prev.y + dy * tt), c);
      }
    } else {
      drawBrushPixel(ctx, p.x, p.y, c);
    }
    lastPixel.current = p;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const sp = getSubPixel(e);
    mousePos.current = sp;
    scheduleCursorUpdate();

    if (!drawing.current) return;
    const p = getPixel(e);
    if (!p) return;
    const t = toolRef.current;

    if (t === "move" && shapeStart.current) {
      const dx = p.x - shapeStart.current.x;
      const dy = p.y - shapeStart.current.y;
      if (dx !== 0 || dy !== 0) {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          movePixels(ctx, dx, dy);
          shapeStart.current = p;
        }
      }
      return;
    }

    if (isShapeTool(t)) {
      if (shapeStart.current) {
        updateShapeDOM(shapeStart.current, p, t);
      }
      return;
    }

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const c = (toolRef.current === "eraser") ? null : prepareColor(colorRef.current);

    if (lastPixel.current) {
      const dx = p.x - lastPixel.current.x;
      const dy = p.y - lastPixel.current.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i++) {
        const tt = steps === 0 ? 0 : i / steps;
        drawBrushPixel(ctx, Math.round(lastPixel.current.x + dx * tt), Math.round(lastPixel.current.y + dy * tt), c);
      }
    } else {
      drawBrushPixel(ctx, p.x, p.y, c);
    }
    lastPixel.current = p;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const t = toolRef.current;

    if (t === "move") {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) pushHistory(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE));
    } else if (isShapeTool(t) && shapeStart.current) {
      const p = getPixel(e) || shapeStart.current;
      commitShape(shapeStart.current, p);
      shapeStart.current = null;
      updateShapeDOM(null, null, t);
    } else if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) pushHistory(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE));
    }

    drawing.current = false;
    lastPixel.current = null;
  };

  const handleCanvasLeave = () => {
    if (drawing.current) {
      const t = toolRef.current;
      if (isShapeTool(t) && shapeStart.current) {
        commitShape(shapeStart.current, shapeStart.current);
        shapeStart.current = null;
        updateShapeDOM(null, null, t);
      } else if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) pushHistory(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE));
      }
      drawing.current = false;
      lastPixel.current = null;
    }
    mousePos.current = null;
    updateCursorDOM(null, toolRef.current, brushSizeRef.current);
  };

  const handleClear = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    pushHistory(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE));
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      addToast("warning", "Enter a name for your crosshair.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL("image/png").split(",")[1];
    try {
      const result = await api.saveDrawnPngCrosshair(base64, saveName.trim());
      if (result.success) {
        addToast("success", result.message);
        setSaveModal(false);
        setSaveName("");
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Save failed: " + String(e));
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (saveModal) return;
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); return; }
      switch (e.key.toLowerCase()) {
        case "p": setTool("pencil"); break;
        case "e": setTool("eraser"); break;
        case "l": setTool("line"); break;
        case "r": setTool(e.shiftKey ? "rectFilled" : "rect"); break;
        case "c": if (!e.ctrlKey) setTool(e.shiftKey ? "circleFilled" : "circle"); break;
        case "g": setTool("fill"); break;
        case "i": setTool("eyedropper"); break;
        case "v": setTool("move"); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveModal]);

  const toolDefs: { id: Tool; icon: typeof Pencil; label: string; shortcut: string }[] = [
    { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "P" },
    { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
    { id: "line", icon: Minus, label: "Line", shortcut: "L" },
    { id: "rect", icon: Square, label: "Rectangle", shortcut: "R" },
    { id: "rectFilled", icon: Square, label: "Rect Filled", shortcut: "Shift+R" },
    { id: "circle", icon: Circle, label: "Circle", shortcut: "C" },
    { id: "circleFilled", icon: Circle, label: "Circle Filled", shortcut: "Shift+C" },
    { id: "fill", icon: PaintBucket, label: "Fill", shortcut: "G" },
    { id: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I" },
    { id: "move", icon: Move, label: "Move", shortcut: "V" },
  ];

  return (
    <div className="space-y-6">
      <Header
        title="Create Cursor (Beta)"
        subtitle="Draw your own custom crosshair"
        actions={
          <Button onClick={() => setSaveModal(true)}>
            <Download size={16} />
            Save to Library
          </Button>
        }
      />

      <div className="flex gap-6">
        <Card className="w-56 shrink-0 space-y-4">
          <div>
            <p className="text-xs font-medium text-surface-400 mb-2 uppercase tracking-wider">Tools</p>
            <div className="grid grid-cols-2 gap-1.5">
              {toolDefs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    title={`${t.label} (${t.shortcut})`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      tool === t.id
                        ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                        : "text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 border border-transparent"
                    }`}
                  >
                    <Icon size={13} />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-surface-400 mb-2 uppercase tracking-wider">Brush Size</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushSize(s)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${
                    brushSize === s
                      ? "bg-brand-600/20 border border-brand-600/30"
                      : "bg-surface-800/50 border border-surface-700/50 hover:border-surface-600"
                  }`}
                >
                  <div
                    className="rounded-full bg-surface-200"
                    style={{ width: s * 3 + 2, height: s * 3 + 2 }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-surface-400 mb-2 uppercase tracking-wider">Color</p>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-9 h-9 rounded-lg border-2 border-surface-600"
                style={{ backgroundColor: color }}
              />
              <label className="relative cursor-pointer">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-0 h-0"
                />
                <div className="w-9 h-9 rounded-lg bg-surface-800 border border-surface-700 flex items-center justify-center text-xs text-surface-400 hover:text-surface-200">
                  Custom
                </div>
              </label>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-md border-2 transition-all cursor-pointer ${
                    color === c ? "border-brand-400 scale-110" : "border-surface-700 hover:border-surface-500"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-surface-400 mb-2 uppercase tracking-wider">Actions</p>
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="flex-1" onClick={undo} disabled={historyIndex <= 0}>
                  <Undo2 size={14} /> Undo
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={redo} disabled={historyIndex >= history.length - 1}>
                  <Redo2 size={14} /> Redo
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowGrid(!showGrid)}>
                <Grid3x3 size={14} /> {showGrid ? "Hide" : "Show"} Grid
              </Button>
              <Button variant="danger" size="sm" className="w-full" onClick={handleClear}>
                <Trash2 size={14} /> Clear Canvas
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex-1 flex items-center justify-center p-8">
          <div
            className="relative border border-surface-700"
            style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleCanvasLeave}
              className="block"
              style={{
                width: DISPLAY_SIZE,
                height: DISPLAY_SIZE,
                imageRendering: "pixelated",
                cursor: "none",
              }}
            />
            <div ref={cursorRef} className="absolute pointer-events-none" style={{ display: "none" }} />
            <svg
              ref={shapeSvgRef}
              width={DISPLAY_SIZE}
              height={DISPLAY_SIZE}
              className="absolute inset-0 pointer-events-none"
              style={{ display: "none", mixBlendMode: "difference" }}
            >
              <line id="sh-line" x1={0} y1={0} x2={0} y2={0} stroke="white" strokeWidth={1} strokeDasharray="4 2" />
              <rect id="sh-rect" x={0} y={0} width={0} height={0} fill="none" stroke="white" strokeWidth={1} strokeDasharray="4 2" />
              <ellipse id="sh-ellipse" cx={0} cy={0} rx={0} ry={0} fill="none" stroke="white" strokeWidth={1} strokeDasharray="4 2" />
            </svg>
            {showGrid && (
              <svg width={DISPLAY_SIZE} height={DISPLAY_SIZE} className="absolute inset-0 pointer-events-none">
                {Array.from({ length: CANVAS_SIZE + 1 }).map((_, i) => (
                  <g key={i}>
                    <line x1={i * DISPLAY_SCALE} y1={0} x2={i * DISPLAY_SCALE} y2={DISPLAY_SIZE} stroke="rgba(100,100,100,0.15)" strokeWidth={i % 4 === 0 ? 0.8 : 0.3} />
                    <line x1={0} y1={i * DISPLAY_SCALE} x2={DISPLAY_SIZE} y2={i * DISPLAY_SCALE} stroke="rgba(100,100,100,0.15)" strokeWidth={i % 4 === 0 ? 0.8 : 0.3} />
                  </g>
                ))}
              </svg>
            )}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #1a1a2e 25%, transparent 25%), linear-gradient(-45deg, #1a1a2e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a2e 75%), linear-gradient(-45deg, transparent 75%, #1a1a2e 75%)",
                backgroundSize: `${DISPLAY_SCALE * 2}px ${DISPLAY_SCALE * 2}px`,
                backgroundPosition: `0 0, 0 ${DISPLAY_SCALE}px, ${DISPLAY_SCALE}px -${DISPLAY_SCALE}px, -${DISPLAY_SCALE}px 0`,
                opacity: 0.3,
              }}
            />
            <svg
              width={DISPLAY_SIZE}
              height={DISPLAY_SIZE}
              className="absolute inset-0 pointer-events-none"
              style={{ mixBlendMode: "difference" }}
            >
              <circle cx={CANVAS_SIZE / 2 * DISPLAY_SCALE} cy={CANVAS_SIZE / 2 * DISPLAY_SCALE} r={3} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
              <line x1={CANVAS_SIZE / 2 * DISPLAY_SCALE - 6} y1={CANVAS_SIZE / 2 * DISPLAY_SCALE} x2={CANVAS_SIZE / 2 * DISPLAY_SCALE + 6} y2={CANVAS_SIZE / 2 * DISPLAY_SCALE} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
              <line x1={CANVAS_SIZE / 2 * DISPLAY_SCALE} y1={CANVAS_SIZE / 2 * DISPLAY_SCALE - 6} x2={CANVAS_SIZE / 2 * DISPLAY_SCALE} y2={CANVAS_SIZE / 2 * DISPLAY_SCALE + 6} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
            </svg>
          </div>
        </Card>
      </div>

      <Modal open={saveModal} onClose={() => { setSaveModal(false); setSaveName(""); }} title="Save Crosshair">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Crosshair Name</label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="My Custom Cursor"
              className="w-full px-3 py-2 bg-surface-950 border border-surface-700/50 rounded-xl text-sm text-surface-200 placeholder:text-surface-600 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 border border-surface-700/50">
            <canvas
              ref={(el) => {
                if (!el || !canvasRef.current) return;
                const ctx = el.getContext("2d");
                if (!ctx) return;
                el.width = 64;
                el.height = 64;
                ctx.drawImage(canvasRef.current, 0, 0);
              }}
              className="w-12 h-12 rounded-lg border border-surface-600"
              style={{ imageRendering: "pixelated" }}
            />
            <div>
              <p className="text-sm text-surface-200">Preview</p>
              <p className="text-xs text-surface-500">64x64 pixels</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setSaveModal(false); setSaveName(""); }}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleSave} disabled={!saveName.trim()}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
