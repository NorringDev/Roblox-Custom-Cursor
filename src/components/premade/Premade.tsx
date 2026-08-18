import { useEffect, useState, useRef, useCallback } from "react";
import {
  Download,
  RefreshCw,
  Crosshair as CrosshairIcon,
  Sparkles,
} from "lucide-react";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useUIStore } from "../../stores/uiStore";
import * as api from "../../lib/tauri";

interface PremadeCrosshair {
  id: string;
  name: string;
}

function LazyPreview({ id, name }: { id: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fetched = useRef(false);

  const load = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    try {
      const data = await api.getPremadePreview(id);
      if (data) setSrc(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          load();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [load]);

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center p-4">
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-16 h-16 object-contain"
        />
      ) : loading ? (
        <RefreshCw size={16} className="animate-spin text-surface-600" />
      ) : (
        <CrosshairIcon size={28} className="text-surface-600" />
      )}
    </div>
  );
}

function LazyThumbnail({ id, name }: { id: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fetched = useRef(false);

  const load = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    try {
      const data = await api.getPremadePreview(id);
      if (data) setSrc(data);
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          load();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [load]);

  return (
    <div ref={ref} className="w-10 h-10 rounded-xl bg-surface-950 border border-surface-800 flex items-center justify-center overflow-hidden p-1">
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-contain"
        />
      ) : (
        <CrosshairIcon size={18} className="text-brand-400" />
      )}
    </div>
  );
}

export function Premade() {
  const { addToast } = useUIStore();
  const [crosshairs, setCrosshairs] = useState<PremadeCrosshair[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    loadPremade();
  }, []);

  const loadPremade = async () => {
    setLoading(true);
    try {
      await api.initPremade();
      const items = await api.getPremadeCrosshairs();
      setCrosshairs(items);
    } catch (e) {
      addToast("error", "Failed to load premade crosshairs: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (item: PremadeCrosshair) => {
    setApplying(item.id);
    try {
      const result = await api.applyPremadeCrosshair(item.id);
      if (result.success) {
        addToast("success", `"${item.name}" applied successfully!`);
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Apply failed: " + String(e));
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Premade Crosshairs" subtitle="Ready-to-use crosshairs" />
        <Card className="flex flex-col items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-surface-500 mb-3" />
          <p className="text-sm text-surface-500">Loading premade crosshairs...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        title="Premade Crosshairs"
        subtitle="Ready-to-use crosshairs by devy.mm2"
        actions={
          <Button variant="ghost" size="sm" onClick={loadPremade}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        }
      />

      {crosshairs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
            <Sparkles size={32} className="text-surface-600" />
          </div>
          <h3 className="text-base font-semibold text-surface-300 mb-1">
            No premade crosshairs found
          </h3>
          <p className="text-sm text-surface-500">
            Try refreshing or check the resources folder.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {crosshairs.map((item) => (
            <Card key={item.id} hover>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LazyThumbnail id={item.id} name={item.name} />
                  <div>
                    <h3 className="text-sm font-semibold text-surface-100">
                      {item.name}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="w-full h-24 rounded-lg bg-surface-950 border border-surface-800 mb-3">
                <LazyPreview id={item.id} name={item.name} />
              </div>

              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => handleApply(item)}
                disabled={applying === item.id}
              >
                {applying === item.id ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Apply
                  </>
                )}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
