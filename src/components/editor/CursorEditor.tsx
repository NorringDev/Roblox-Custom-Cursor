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
  RotateCcw,
  Pipette,
  Minus,
  Square,
  Circle,
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

type Tool = "pencil" | "eraser" | "fill" | "eyedropper" | "line" | "rect" | "circle";

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const lastPixel = useRef<{ x: number; y: number } | null>(null);

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const brushSizeRef = useRef(brushSize);
  const isDrawingRef = useRef(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);

  const cursorOverlayRef = useRef<HTMLDivElement>(null);
  const cursorEyedropperRef = useRef<HTMLDivElement>(null);
  const shapeSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    saveToHistory(imageData);
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const saveToHistory = (imageData: ImageData) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const getPixelPos = (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return null;
    return { x, y };
  };

  const getPixelColor = (ctx: CanvasRenderingContext2D, x: number, y: number): string => {
    const data = ctx.getImageData(x, y, 1, 1).data;
    return `#${data[0].toString(16).padStart(2, "0")}${data[1].toString(16).padStart(2, "0")}${data[2].toString(16).padStart(2, "0")}${data[3].toString(16).padStart(2, "0")}`;
  };

  const drawPixel = (ctx: CanvasRenderingContext2D, x: number, y: number, c: string, size: number) => {
    const half = Math.floor(size / 2);
    if (c === "eraser") {
      for (let dx = -half; dx <= half; dx++) {
        for (let dy = -half; dy <= half; dy++) {
          const px = x + dx, py = y + dy;
          if (px >= 0 && px < CANVAS_SIZE && py >= 0 && py < CANVAS_SIZE) {
            ctx.clearRect(px, py, 1, 1);
          }
        }
      }
    } else {
      const colorStr = prepareColor(c)!;
      ctx.fillStyle = colorStr;
      for (let dx = -half; dx <= half; dx++) {
        for (let dy = -half; dy <= half; dy++) {
          const px = x + dx, py = y + dy;
          if (px >= 0 && px < CANVAS_SIZE && py >= 0 && py < CANVAS_SIZE) {
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  };

  const setPixel = (ctx: CanvasRenderingContext2D, x: number, y: number, c: string) => {
    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return;
    if (c === "eraser") {
      ctx.clearRect(x, y, 1, 1);
    } else {
      const [r, g, b, a] = hexToRgb(c);
      ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
      ctx.fillRect(x, y, 1, 1);
    }
  };

  const prepareColor = (c: string) => {
    if (c === "eraser") return null;
    const [r, g, b, a] = hexToRgb(c);
    return `rgba(${r},${g},${b},${a / 255})`;
  };

  const setPixelFast = (ctx: CanvasRenderingContext2D, x: number, y: number, colorStr: string | null) => {
    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return;
    if (!colorStr) {
      ctx.clearRect(x, y, 1, 1);
    } else {
      ctx.fillStyle = colorStr;
      ctx.fillRect(x, y, 1, 1);
    }
  };

  const drawLinePixels = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string) => {
    const colorStr = prepareColor(c);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      setPixelFast(ctx, x0, y0, colorStr);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  const drawRectPixels = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string) => {
    const colorStr = prepareColor(c);
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    for (let x = minX; x <= maxX; x++) {
      setPixelFast(ctx, x, minY, colorStr);
      setPixelFast(ctx, x, maxY, colorStr);
    }
    for (let y = minY; y <= maxY; y++) {
      setPixelFast(ctx, minX, y, colorStr);
      setPixelFast(ctx, maxX, y, colorStr);
    }
  };

  const drawCirclePixels = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string) => {
    const colorStr = prepareColor(c);
    const cx = Math.round((x0 + x1) / 2);
    const cy = Math.round((y0 + y1) / 2);
    const rx = Math.round(Math.abs(x1 - x0) / 2);
    const ry = Math.round(Math.abs(y1 - y0) / 2);

    if (rx === 0 && ry === 0) {
      setPixelFast(ctx, cx, cy, colorStr);
      return;
    }

    if (rx > 0 && ry === 0) {
      for (let x = cx - rx; x <= cx + rx; x++) setPixelFast(ctx, x, cy, colorStr);
      return;
    }
    if (rx === 0 && ry > 0) {
      for (let y = cy - ry; y <= cy + ry; y++) setPixelFast(ctx, cx, y, colorStr);
      return;
    }

    let a = rx, b = ry;
    let aSq = a * a, bSq = b * b;
    let dx = 0, dy = b;
    let d1 = bSq - aSq * b + 0.25 * aSq;

    while (dx * bSq < dy * aSq) {
      setPixelFast(ctx, cx + dx, cy + dy, colorStr);
      setPixelFast(ctx, cx - dx, cy + dy, colorStr);
      setPixelFast(ctx, cx + dx, cy - dy, colorStr);
      setPixelFast(ctx, cx - dx, cy - dy, colorStr);
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
      setPixelFast(ctx, cx + dx, cy + dy, colorStr);
      setPixelFast(ctx, cx - dx, cy + dy, colorStr);
      setPixelFast(ctx, cx + dx, cy - dy, colorStr);
      setPixelFast(ctx, cx - dx, cy - dy, colorStr);
      dy--;
      if (d2 > 0) {
        d2 += aSq * (1 - 2 * dy);
      } else {
        dx++;
        d2 += bSq * (2 * dx + 1) + aSq * (1 - 2 * dy);
      }
    }
  };

  const commitShape = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const c = toolRef.current === "eraser" ? "eraser" : colorRef.current;
    if (toolRef.current === "line") drawLinePixels(ctx, start.x, start.y, end.x, end.y, c);
    else if (toolRef.current === "rect") drawRectPixels(ctx, start.x, start.y, end.x, end.y, c);
    else if (toolRef.current === "circle") drawCirclePixels(ctx, start.x, start.y, end.x, end.y, c);
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    saveToHistory(imageData);
  };

  const floodFill = (ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: string) => {
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const data = imageData.data;
    const startIdx = (startY * CANVAS_SIZE + startX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];

    const [fillR, fillG, fillB, fillA] = hexToRgb(fillColor);

    if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) return;

    const stack: [number, number][] = [[startX, startY]];
    const visited = new Set<number>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = (y * CANVAS_SIZE + x) * 4;
      const key = y * CANVAS_SIZE + x;

      if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) continue;
      if (visited.has(key)) continue;
      if (data[idx] !== startR || data[idx + 1] !== startG || data[idx + 2] !== startB || data[idx + 3] !== startA) continue;

      visited.add(key);
      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const drawAtPos = (pos: { x: number; y: number }, ctx: CanvasRenderingContext2D) => {
    const c = toolRef.current === "eraser" ? "eraser" : colorRef.current;
    if (lastPixel.current) {
      const dx = pos.x - lastPixel.current.x;
      const dy = pos.y - lastPixel.current.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const ix = Math.round(lastPixel.current.x + dx * t);
        const iy = Math.round(lastPixel.current.y + dy * t);
        drawPixel(ctx, ix, iy, c, brushSizeRef.current);
      }
    } else {
      drawPixel(ctx, pos.x, pos.y, c, brushSizeRef.current);
    }
    lastPixel.current = pos;
  };

  const updateCursorOverlay = (pos: { x: number; y: number } | null) => {
    const cur = cursorOverlayRef.current;
    if (!cur) return;
    if (!pos || toolRef.current === "eyedropper") {
      cur.style.display = "none";
      return;
    }
    const bs = brushSizeRef.current;
    cur.style.display = "block";
    cur.style.width = bs * DISPLAY_SCALE + "px";
    cur.style.height = bs * DISPLAY_SCALE + "px";
    cur.style.left = (pos.x * DISPLAY_SCALE - (bs * DISPLAY_SCALE) / 2) + "px";
    cur.style.top = (pos.y * DISPLAY_SCALE - (bs * DISPLAY_SCALE) / 2) + "px";
  };

  const updateEyedropperOverlay = (pos: { x: number; y: number } | null) => {
    const cur = cursorEyedropperRef.current;
    if (!cur) return;
    if (!pos || toolRef.current !== "eyedropper") {
      cur.style.display = "none";
      return;
    }
    cur.style.display = "block";
    cur.style.left = (pos.x * DISPLAY_SCALE + DISPLAY_SCALE / 2) + "px";
    cur.style.top = (pos.y * DISPLAY_SCALE + DISPLAY_SCALE / 2) + "px";
  };

  const updateShapeOverlay = (start: { x: number; y: number } | null, end: { x: number; y: number } | null) => {
    const svg = shapeSvgRef.current;
    if (!svg) return;
    if (!start || !end) {
      svg.style.display = "none";
      return;
    }
    svg.style.display = "block";
    const lineEl = svg.querySelector<SVGLineElement>("#preview-line");
    const rectEl = svg.querySelector<SVGRectElement>("#preview-rect");
    const ellipseEl = svg.querySelector<SVGEllipseElement>("#preview-ellipse");
    const currentTool = toolRef.current;

    if (lineEl) lineEl.style.display = currentTool === "line" ? "" : "none";
    if (rectEl) rectEl.style.display = currentTool === "rect" ? "" : "none";
    if (ellipseEl) ellipseEl.style.display = currentTool === "circle" ? "" : "none";

    if (currentTool === "line" && lineEl) {
      lineEl.setAttribute("x1", String(start.x * DISPLAY_SCALE + DISPLAY_SCALE / 2));
      lineEl.setAttribute("y1", String(start.y * DISPLAY_SCALE + DISPLAY_SCALE / 2));
      lineEl.setAttribute("x2", String(end.x * DISPLAY_SCALE + DISPLAY_SCALE / 2));
      lineEl.setAttribute("y2", String(end.y * DISPLAY_SCALE + DISPLAY_SCALE / 2));
    } else if (currentTool === "rect" && rectEl) {
      const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
      rectEl.setAttribute("x", String(minX * DISPLAY_SCALE));
      rectEl.setAttribute("y", String(minY * DISPLAY_SCALE));
      rectEl.setAttribute("width", String((maxX - minX + 1) * DISPLAY_SCALE));
      rectEl.setAttribute("height", String((maxY - minY + 1) * DISPLAY_SCALE));
    } else if (currentTool === "circle" && ellipseEl) {
      const cx = (start.x + end.x) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2;
      const cy = (start.y + end.y) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2;
      const rx = Math.abs(end.x - start.x) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2;
      const ry = Math.abs(end.y - start.y) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2;
      ellipseEl.setAttribute("cx", String(cx));
      ellipseEl.setAttribute("cy", String(cy));
      ellipseEl.setAttribute("rx", String(rx));
      ellipseEl.setAttribute("ry", String(ry));
    }
  };

  const handleCanvasMouseMoveRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPixelPos(e);
    if (!pos) return;
    const curTool = toolRef.current;

    if (curTool === "eyedropper") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const c = getPixelColor(ctx, pos.x, pos.y);
      if (!c.endsWith("00")) {
        setColor(c);
        setTool("pencil");
      }
      return;
    }

    if (curTool === "fill") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      floodFill(ctx, pos.x, pos.y, colorRef.current);
      const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      saveToHistory(imageData);
      return;
    }

    if (curTool === "line" || curTool === "rect" || curTool === "circle") {
      shapeStartRef.current = pos;
      updateShapeOverlay(pos, pos);
      setIsDrawing(true);
      isDrawingRef.current = true;
      return;
    }

    setIsDrawing(true);
    isDrawingRef.current = true;
    lastPixel.current = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawAtPos(pos, ctx);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPixelPos(e);
    handleCanvasMouseMoveRef.current = pos;

    if (toolRef.current === "eyedropper") {
      updateEyedropperOverlay(pos);
      updateCursorOverlay(null);
    } else {
      updateCursorOverlay(pos);
      updateEyedropperOverlay(null);
    }

    if (!isDrawingRef.current) return;

    if (toolRef.current === "line" || toolRef.current === "rect" || toolRef.current === "circle") {
      if (shapeStartRef.current && pos) {
        updateShapeOverlay(shapeStartRef.current, pos);
      }
      return;
    }

    if (!pos) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawAtPos(pos, ctx);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const curTool = toolRef.current;
    const isShape = curTool === "line" || curTool === "rect" || curTool === "circle";

    if (isShape && isDrawingRef.current && shapeStartRef.current) {
      const pos = getPixelPos(e) || shapeStartRef.current;
      commitShape(shapeStartRef.current, pos);
      shapeStartRef.current = null;
      updateShapeOverlay(null, null);
    } else if (isDrawingRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        saveToHistory(imageData);
      }
    }
    setIsDrawing(false);
    isDrawingRef.current = false;
    lastPixel.current = null;
  };

  const handleCanvasLeave = () => {
    const curTool = toolRef.current;
    const isShape = curTool === "line" || curTool === "rect" || curTool === "circle";

    if (isShape && isDrawingRef.current && shapeStartRef.current) {
      const lastPos = handleCanvasMouseMoveRef.current || shapeStartRef.current;
      commitShape(shapeStartRef.current, lastPos);
      shapeStartRef.current = null;
      updateShapeOverlay(null, null);
    } else if (isDrawingRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        saveToHistory(imageData);
      }
    }
    setIsDrawing(false);
    isDrawingRef.current = false;
    lastPixel.current = null;
    updateCursorOverlay(null);
    updateEyedropperOverlay(null);
  };

  const handleClear = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    saveToHistory(imageData);
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      addToast("warning", "Enter a name for your crosshair.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];

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

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: "pencil", icon: Pencil, label: "Pencil" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "circle", icon: Circle, label: "Circle" },
    { id: "fill", icon: PaintBucket, label: "Fill" },
    { id: "eyedropper", icon: Pipette, label: "Eyedropper" },
  ];

  return (
    <div className="space-y-6">
      <Header
        title="Create Cursor"
        subtitle="Draw your own custom crosshair"
        actions={
          <Button onClick={() => setSaveModal(true)}>
            <Download size={16} />
            Save to Library
          </Button>
        }
      />

      <div className="flex gap-6">
        {/* Toolbar */}
        <Card className="w-56 shrink-0 space-y-4">
          <div>
            <p className="text-xs font-medium text-surface-400 mb-2 uppercase tracking-wider">Tools</p>
            <div className="grid grid-cols-2 gap-1.5">
              {tools.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      tool === t.id
                        ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                        : "text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 border border-transparent"
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                >
                  <Undo2 size={14} />
                  Undo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                >
                  <Redo2 size={14} />
                  Redo
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3x3 size={14} />
                {showGrid ? "Hide" : "Show"} Grid
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                onClick={handleClear}
              >
                <Trash2 size={14} />
                Clear Canvas
              </Button>
            </div>
          </div>
        </Card>

        {/* Canvas */}
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
            <div
              ref={cursorOverlayRef}
              className="absolute pointer-events-none border border-white/70 rounded-sm"
              style={{
                display: "none",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                mixBlendMode: "difference",
              }}
            />
            <div
              ref={cursorEyedropperRef}
              className="absolute pointer-events-none w-5 h-5 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                display: "none",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
              }}
            />
            <svg
              ref={shapeSvgRef}
              width={DISPLAY_SIZE}
              height={DISPLAY_SIZE}
              className="absolute inset-0 pointer-events-none"
              style={{ display: "none", mixBlendMode: "difference" }}
            >
              <line
                id="preview-line"
                x1={0} y1={0} x2={0} y2={0}
                stroke="white" strokeWidth={1} strokeDasharray="4 2"
              />
              <rect
                id="preview-rect"
                x={0} y={0} width={0} height={0}
                fill="none" stroke="white" strokeWidth={1} strokeDasharray="4 2"
              />
              <ellipse
                id="preview-ellipse"
                cx={0} cy={0} rx={0} ry={0}
                fill="none" stroke="white" strokeWidth={1} strokeDasharray="4 2"
              />
            </svg>
            {showGrid && (
              <svg
                width={DISPLAY_SIZE}
                height={DISPLAY_SIZE}
                className="absolute inset-0 pointer-events-none"
              >
                {Array.from({ length: CANVAS_SIZE + 1 }).map((_, i) => (
                  <g key={i}>
                    <line
                      x1={i * DISPLAY_SCALE}
                      y1={0}
                      x2={i * DISPLAY_SCALE}
                      y2={DISPLAY_SIZE}
                      stroke="rgba(100,100,100,0.15)"
                      strokeWidth={i % 4 === 0 ? 0.8 : 0.3}
                    />
                    <line
                      x1={0}
                      y1={i * DISPLAY_SCALE}
                      x2={DISPLAY_SIZE}
                      y2={i * DISPLAY_SCALE}
                      stroke="rgba(100,100,100,0.15)"
                      strokeWidth={i % 4 === 0 ? 0.8 : 0.3}
                    />
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
          </div>
        </Card>
      </div>

      {/* Save Modal */}
      <Modal
        open={saveModal}
        onClose={() => {
          setSaveModal(false);
          setSaveName("");
        }}
        title="Save Crosshair"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Crosshair Name
            </label>
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
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setSaveModal(false);
                setSaveName("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSave}
              disabled={!saveName.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
