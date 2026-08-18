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

type Tool = "pencil" | "eraser" | "fill" | "eyedropper";

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
    const [r, g, b, a] = hexToRgb(c);
    const half = Math.floor(size / 2);
    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < CANVAS_SIZE && py >= 0 && py < CANVAS_SIZE) {
          ctx.fillStyle = c === "eraser" ? "rgba(0,0,0,0)" : c;
          if (c === "eraser") {
            ctx.clearRect(px, py, 1, 1);
          } else {
            ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    lastPixel.current = null;
    const pos = getPixelPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    if (tool === "eyedropper") {
      const c = getPixelColor(ctx, pos.x, pos.y);
      if (!c.endsWith("00")) {
        setColor(c);
        setTool("pencil");
      }
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPixelPos(e);
    setCursorPos(pos);
    if (!isDrawing) return;
    if (tool === "eyedropper" || tool === "fill") return;
    if (!pos) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawAtPos(pos, ctx);
  };

  const handleMouseUp = () => {
    if (isDrawing && canvasRef.current) {
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
    handleMouseUp();
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
