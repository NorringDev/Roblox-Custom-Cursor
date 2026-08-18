import { useState, useRef, useCallback, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Upload,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Check,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Save,
  Palette,
} from "lucide-react";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useUIStore } from "../../stores/uiStore";
import * as api from "../../lib/tauri";

const CANVAS_SIZE = 300;

interface CollectionItem {
  id: string;
  name: string;
  path: string;
  borderColor: string;
  borderWidth: number;
}

export function EmoteWheel() {
  const { addToast } = useUIStore();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isModified, setIsModified] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [borderColor, setBorderColor] = useState("#ffffff");
  const [borderWidth, setBorderWidth] = useState(0);
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getEmoteBgStatus().then(setIsModified).catch(() => {});
    loadCollection();
  }, []);

  const loadCollection = async () => {
    try {
      const items = await api.getEmoteBgCollection();
      setCollection(items);
    } catch {
      // silent
    }
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const imgW = imageObj.naturalWidth;
    const imgH = imageObj.naturalHeight;
    const baseScale = Math.max(CANVAS_SIZE / imgW, CANVAS_SIZE / imgH);
    const scale = baseScale * zoom;
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (CANVAS_SIZE - drawW) / 2 + offset.x;
    const y = (CANVAS_SIZE - drawH) / 2 + offset.y;

    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const radius = CANVAS_SIZE / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(imageObj, x, y, drawW, drawH);
    ctx.restore();

    if (borderWidth > 0) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth * (CANVAS_SIZE / 512) * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [imageObj, zoom, offset, borderColor, borderWidth]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handlePickImage = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
        ],
      });
      if (!selected) return;

      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return;

      const img = new Image();
      img.onload = () => {
        setImageObj(img);
        setImageSrc(path);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      img.onerror = () => {
        addToast("error", "Failed to load image preview");
      };
      img.src = convertFileSrc(path);
    } catch (e) {
      addToast("error", "Failed to open file: " + String(e));
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(5, Math.max(0.2, z + delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!imageObj) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    },
    [imageObj, offset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleApply = async () => {
    if (!imageSrc) return;
    setApplying(true);
    try {
      const result = await api.applyEmoteBg(imageSrc, zoom, offset.x, offset.y, borderColor, borderWidth);
      if (result.success) {
        addToast("success", "Emote wheel background applied!");
        setIsModified(true);
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed to apply: " + String(e));
    } finally {
      setApplying(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await api.restoreEmoteBg();
      if (result.success) {
        addToast("success", "Emote wheel background restored!");
        setIsModified(false);
        setImageSrc(null);
        setImageObj(null);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed to restore: " + String(e));
    } finally {
      setRestoring(false);
    }
  };

  const handleSave = async () => {
    if (!imageSrc || !saveName.trim()) return;
    try {
      const result = await api.saveEmoteBgCollection(
        saveName.trim(), imageSrc, zoom, offset.x, offset.y, borderColor, borderWidth
      );
      if (result.success) {
        addToast("success", result.message);
        setShowSaveDialog(false);
        setSaveName("");
        loadCollection();
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed to save: " + String(e));
    }
  };

  const handleApplyCollection = async (item: CollectionItem) => {
    try {
      const result = await api.applyEmoteBgCollection(item.id);
      if (result.success) {
        addToast("success", `"${item.name}" applied!`);
        setIsModified(true);
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed to apply: " + String(e));
    }
  };

  const handleDeleteCollection = async (item: CollectionItem) => {
    try {
      const result = await api.deleteEmoteBgCollection(item.id);
      if (result.success) {
        addToast("success", `"${item.name}" deleted`);
        loadCollection();
      }
    } catch (e) {
      addToast("error", "Failed to delete: " + String(e));
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title="Emote Wheel Background"
        subtitle="Customize the background of your emote wheel"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-surface-100 mb-4">
            Preview
          </h3>
          <div
            ref={containerRef}
            className="relative flex items-center justify-center"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? "grabbing" : imageObj ? "grab" : "default" }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="rounded-full"
              style={{
                background:
                  "repeating-conic-gradient(#1a1a2e 0% 25%, #16213e 0% 50%) 50% / 20px 20px",
              }}
            />
            {!imageObj && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <ImageIcon size={48} className="text-surface-600 mb-3" />
                <p className="text-sm text-surface-500">
                  Pick an image to get started
                </p>
              </div>
            )}
          </div>

          {imageObj && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.min(5, z + 0.2))}
              >
                <ZoomIn size={14} />
              </Button>
              <span className="text-xs text-surface-500 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}
              >
                <ZoomOut size={14} />
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-surface-100 mb-4">
            Controls
          </h3>
          <div className="space-y-3">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={handlePickImage}
            >
              <Upload size={16} />
              Pick Image
            </Button>

            {imageObj && (
              <>
                <div className="pt-3 border-t border-surface-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Palette size={14} className="text-surface-400" />
                    <span className="text-xs font-medium text-surface-400">Border</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={borderColor}
                        onChange={(e) => setBorderColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-surface-600 cursor-pointer bg-transparent"
                      />
                      <span className="text-xs text-surface-500">{borderColor}</span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={borderWidth}
                        onChange={(e) => setBorderWidth(Number(e.target.value))}
                        className="w-full h-1.5 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                      />
                      <span className="text-[10px] text-surface-600">{borderWidth}px</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={handleApply}
                  disabled={applying}
                >
                  {applying ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  {applying ? "Applying..." : "Apply Background"}
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <Save size={16} />
                  Save to Collection
                </Button>
              </>
            )}

            {isModified && (
              <Button
                variant="danger"
                size="md"
                className="w-full"
                onClick={handleRestore}
                disabled={restoring}
              >
                {restoring ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <RotateCcw size={16} />
                )}
                {restoring ? "Restoring..." : "Restore Default"}
              </Button>
            )}

            {imageObj && (
              <div className="pt-4 border-t border-surface-700/50">
                <h4 className="text-xs font-medium text-surface-400 mb-2">
                  Tips
                </h4>
                <ul className="text-xs text-surface-500 space-y-1">
                  <li>Scroll to zoom in/out</li>
                  <li>Click and drag to pan the image</li>
                  <li>The image is cropped to a circle</li>
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      {showSaveDialog && (
        <Card>
          <h3 className="text-sm font-semibold text-surface-100 mb-3">
            Save to Collection
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Enter name..."
              className="flex-1 px-3 py-2 text-sm bg-surface-800 border border-surface-600 rounded-xl text-surface-200 placeholder:text-surface-600 focus:outline-none focus:border-brand-500"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!saveName.trim()}>
              <Save size={14} />
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowSaveDialog(false); setSaveName(""); }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {collection.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-surface-100 mb-4">
            Collection
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {collection.map((item) => (
              <div
                key={item.id}
                className="relative group bg-surface-800/50 border border-surface-700/50 rounded-xl p-3 flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border-2" style={{ borderColor: item.borderColor || "transparent" }}>
                  <img
                    src={convertFileSrc(item.path)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs text-surface-300 text-center truncate w-full">
                  {item.name}
                </span>
                <div className="flex gap-1 w-full">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleApplyCollection(item)}
                  >
                    <Check size={12} />
                    Apply
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteCollection(item)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
