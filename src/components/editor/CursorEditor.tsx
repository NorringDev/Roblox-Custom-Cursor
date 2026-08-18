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
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [shapePreview, setShapePreview] = useState<{ x: number; y: number } | null>(null);
  const lastPixel = useRef<{ x: number; y: number } | null>(null);

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

  const getPixelPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;

    if (rx < 0.5 && ry < 0.5) {
      setPixelFast(ctx, Math.round(cx), Math.round(cy), colorStr);
      return;
    }

    if (rx >= ry) {
      let x = Math.round(rx);
      let y = 0;
      let d1 = ry * ry - rx * rx * ry + rx * rx / 4;
      let dx = 2 * ry * ry * x;
      let dy = 0;
      while (dx >= dy) {
        setPixelFast(ctx, Math.round(cx + x), Math.round(cy + y), colorStr);
        setPixelFast(ctx, Math.round(cx - x), Math.round(cy + y), colorStr);
        setPixelFast(ctx, Math.round(cx + x), Math.round(cy - y), colorStr);
        setPixelFast(ctx, Math.round(cx - x), Math.round(cy - y), colorStr);
        y++;
        dy += 2 * rx * rx;
        if (d1 < 0) {
          d1 += ry * ry + dy;
        } else {
          x--;
          dx -= 2 * ry * ry;
          d1 += ry * ry - dx + dy;
        }
      }
      let d2 = ry * ry * (x * x + x + 0.25) + rx * rx * (y - 1) * (y - 1) - rx * rx * ry * ry;
      while (y <= Math.round(ry)) {
        setPixelFast(ctx, Math.round(cx + x), Math.round(cy + y), colorStr);
        setPixelFast(ctx, Math.round(cx - x), Math.round(cy + y), colorStr);
        setPixelFast(ctx, Math.round(cx + x), Math.round(cy - y), colorStr);
        setPixelFast(ctx, Math.round(cx - x), Math.round(cy - y), colorStr);
        y++;
        if (d2 > 0) {
          d2 += rx * rx - dx;
        } else {
          x--;
          dx -= 2 * ry * ry;
          d2 += rx * ry * ry - dx;
        }
      }
    } else {
      let y = Math.round(ry);
      let x = 0;
      let d1 = rx * rx - ry * ry * rx + ry * ry / 4;
      let dy = 2 * rx * rx * y;
      let dx = 0;
      while (dy >= dx) {
        setPixelFast(ctx, Math.round(cx + x), Math.round(cy + y), colorStr);
        setPixelFast(ctx, Math.round(cx - x), Math.round(cy + y), colorStr);
        setPixelFast(ctx, Math.round(cx + x), Math.round(cy - y), colorStr);
        setPixelFast(ctx, Math.round(cx - x), Math.round(cy - y), colorStr);
        x++;
        dx += 2 * ry * ry;
        if (d1 < 0) {
          d1 += rx * rx + dx;
        } else {
          y--;
          dy -= 2 * rx * rx;
          d1 += rx * rx - dy + dx;
        }
      }
      let d2 = rx * rx * (y * y + y + 0.25) + ry * ry * (x - 1) * (x - 1) - ry * ry * rx * rx;
      while (x <= Math.round(rx)) {
        setPixelFast(ctx, Math.round(cx + x), Math.round(cy + y), colorStr);
        setPixelFast(ctx, Math.round(cx - x), Math.round(cy + y), colorStr);
        setPixelFast(ctx, Math.round(cx + x), Math.round(cy - y), colorStr);
        setPixelFast(ctx, Math.round(cx - x), Math.round(cy - y), colorStr);
        x++;
        if (d2 > 0) {
          d2 += ry * ry - dy;
        } else {
          y--;
          dy -= 2 * rx * rx;
          d2 += ry * rx * rx - dy;
        }
      }
    }
  };

  const commitShape = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const c = tool === "eraser" ? "eraser" : color;
    if (tool === "line") drawLinePixels(ctx, start.x, start.y, end.x, end.y, c);
    else if (tool === "rect") drawRectPixels(ctx, start.x, start.y, end.x, end.y, c);
    else if (tool === "circle") drawCirclePixels(ctx, start.x, start.y, end.x, end.y, c);
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
    const c = tool === "eraser" ? "eraser" : color;
    if (lastPixel.current) {
      const dx = pos.x - lastPixel.current.x;
      const dy = pos.y - lastPixel.current.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const ix = Math.round(lastPixel.current.x + dx * t);
        const iy = Math.round(lastPixel.current.y + dy * t);
        drawPixel(ctx, ix, iy, c, brushSize);
      }
    } else {
      drawPixel(ctx, pos.x, pos.y, c, brushSize);
    }
    lastPixel.current = pos;
  };

  const handleCanvasAction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPixelPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    if (tool === "eyedropper") {
      const c = getPixelColor(ctx, pos.x, pos.y);
      if (c.endsWith("00")) return;
      setColor(c);
      setTool("pencil");
      return;
    }

    if (tool === "fill") {
      floodFill(ctx, pos.x, pos.y, color);
      const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      saveToHistory(imageData);
      return;
    }

    drawAtPos(pos, ctx);
  };

  const isShapeTool = tool === "line" || tool === "rect" || tool === "circle";

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPixelPos(e);
    if (!pos) return;

    if (tool === "eyedropper") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const c = getPixelColor(ctx, pos.x, pos.y);
      if (!c.endsWith("00")) {
        setColor(c);
        setTool("pencil");
      }
      return;
    }

    if (tool === "fill") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      floodFill(ctx, pos.x, pos.y, color);
      const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      saveToHistory(imageData);
      return;
    }

    if (isShapeTool) {
      setShapeStart(pos);
      setShapePreview(pos);
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    lastPixel.current = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawAtPos(pos, ctx);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPixelPos(e);
    setCursorPos(pos);
    if (!isDrawing) return;
    if (tool === "eyedropper" || tool === "fill") return;

    if (isShapeTool) {
      setShapePreview(pos);
      return;
    }

    if (!pos) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawAtPos(pos, ctx);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isShapeTool && isDrawing && shapeStart) {
      const pos = getPixelPos(e) || shapeStart;
      commitShape(shapeStart, pos);
      setShapeStart(null);
      setShapePreview(null);
    } else if (isDrawing && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        saveToHistory(imageData);
      }
    }
    setIsDrawing(false);
    lastPixel.current = null;
  };

  const handleCanvasLeave = () => {
    if (isShapeTool && isDrawing && shapeStart && shapePreview) {
      commitShape(shapeStart, shapePreview);
      setShapeStart(null);
      setShapePreview(null);
    } else if (isDrawing && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        saveToHistory(imageData);
      }
    }
    setIsDrawing(false);
    lastPixel.current = null;
    setCursorPos(null);
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
            {cursorPos && tool !== "eyedropper" && (
              <div
                className="absolute pointer-events-none border border-white/70 rounded-sm"
                style={{
                  width: brushSize * DISPLAY_SCALE,
                  height: brushSize * DISPLAY_SCALE,
                  left: cursorPos.x * DISPLAY_SCALE - (brushSize * DISPLAY_SCALE) / 2,
                  top: cursorPos.y * DISPLAY_SCALE - (brushSize * DISPLAY_SCALE) / 2,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                  mixBlendMode: "difference",
                }}
              />
            )}
            {cursorPos && tool === "eyedropper" && (
              <div
                className="absolute pointer-events-none w-5 h-5 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: cursorPos.x * DISPLAY_SCALE + DISPLAY_SCALE / 2,
                  top: cursorPos.y * DISPLAY_SCALE + DISPLAY_SCALE / 2,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                }}
              />
            )}
            {isShapeTool && shapeStart && shapePreview && (
              <svg
                width={DISPLAY_SIZE}
                height={DISPLAY_SIZE}
                className="absolute inset-0 pointer-events-none"
                style={{ mixBlendMode: "difference" }}
              >
                {tool === "line" && (
                  <line
                    x1={shapeStart.x * DISPLAY_SCALE + DISPLAY_SCALE / 2}
                    y1={shapeStart.y * DISPLAY_SCALE + DISPLAY_SCALE / 2}
                    x2={shapePreview.x * DISPLAY_SCALE + DISPLAY_SCALE / 2}
                    y2={shapePreview.y * DISPLAY_SCALE + DISPLAY_SCALE / 2}
                    stroke="white"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                  />
                )}
                {tool === "rect" && (
                  <rect
                    x={Math.min(shapeStart.x, shapePreview.x) * DISPLAY_SCALE}
                    y={Math.min(shapeStart.y, shapePreview.y) * DISPLAY_SCALE}
                    width={(Math.abs(shapePreview.x - shapeStart.x) + 1) * DISPLAY_SCALE}
                    height={(Math.abs(shapePreview.y - shapeStart.y) + 1) * DISPLAY_SCALE}
                    fill="none"
                    stroke="white"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                  />
                )}
                {tool === "circle" && (
                  <ellipse
                    cx={(shapeStart.x + shapePreview.x) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2}
                    cy={(shapeStart.y + shapePreview.y) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2}
                    rx={Math.abs(shapePreview.x - shapeStart.x) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2}
                    ry={Math.abs(shapePreview.y - shapeStart.y) / 2 * DISPLAY_SCALE + DISPLAY_SCALE / 2}
                    fill="none"
                    stroke="white"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                  />
                )}
              </svg>
            )}
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
