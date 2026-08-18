import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Upload,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Check,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useUIStore } from "../../stores/uiStore";
import * as api from "../../lib/tauri";
import { open } from "@tauri-apps/plugin-dialog";

const CANVAS_SIZE = 300;

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getEmoteBgStatus().then(setIsModified).catch(() => {});
  }, []);

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

    ctx.save();
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(imageObj, x, y, drawW, drawH);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [imageObj, zoom, offset]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handlePickImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
        ],
      });
      if (!selected) return;

      const path = typeof selected === "string" ? selected : selected;
      const img = new Image();
      img.onload = () => {
        setImageObj(img);
        setImageSrc(path);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      img.src = `asset://localhost/${encodeURIComponent(path)}`;
    } catch (e) {
      addToast("error", "Failed to open file: " + String(e));
    }
  };

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(5, Math.max(0.2, z + delta)));
    },
    []
  );

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
    if (!canvasRef.current) return;
    setApplying(true);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const tempPath = await invoke<string>(
        "save_drawn_crosshair",
        { pngData: base64, name: "__emote_bg_temp__" }
      );

      const result = await api.applyEmoteBg(tempPath);
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
              className="rounded-full border border-surface-700/50"
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
    </div>
  );
}
