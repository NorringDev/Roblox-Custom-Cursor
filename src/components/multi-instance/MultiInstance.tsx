import { useState, useEffect } from "react";
import { RefreshCw, Shield, ShieldOff, AlertTriangle } from "lucide-react";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";
import { useUIStore } from "../../stores/uiStore";
import * as api from "../../lib/tauri";

export function MultiInstance() {
  const { addToast } = useUIStore();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    api.getMultiInstanceStatus()
      .then((s) => setEnabled(s.enabled))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const result = await api.toggleMultiInstance(!enabled);
      if (result.success) {
        setEnabled(!enabled);
        addToast("success", result.message);
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed: " + String(e));
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title="Multi-Instance"
        subtitle="Run multiple Roblox accounts at the same time"
      />

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {enabled ? (
              <Shield size={20} className="text-green-400" />
            ) : (
              <ShieldOff size={20} className="text-surface-500" />
            )}
            <div>
              <p className="text-sm font-medium text-surface-200">
                Multi-Instance {enabled ? "Enabled" : "Disabled"}
              </p>
              <p className="text-xs text-surface-500">
                {enabled
                  ? "Multiple Roblox instances can run simultaneously"
                  : "Only one Roblox instance can run at a time"}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={loading || toggling}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer ${
              enabled ? "bg-green-500" : "bg-surface-700"
            } ${loading || toggling ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {toggling && (
          <div className="mt-3 flex items-center gap-2 text-xs text-surface-400">
            <RefreshCw size={12} className="animate-spin" />
            <span>Patching Roblox executable...</span>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-surface-100 mb-3">
          How it works
        </h3>
        <ul className="text-xs text-surface-500 space-y-1.5">
          <li>When enabled, Roblox is patched to allow multiple instances</li>
          <li>Close all Roblox windows before enabling</li>
          <li>You can then launch as many Roblox instances as you want from the website</li>
          <li>Disable to restore Roblox to its original state</li>
        </ul>
      </Card>

      <Card>
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-xs text-surface-500">
            This modifies the Roblox executable temporarily. The original is backed up and
            restored when you disable this feature. Make sure all Roblox instances are closed
            before toggling.
          </p>
        </div>
      </Card>
    </div>
  );
}
