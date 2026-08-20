import { useState, useEffect } from "react";
import {
  Plus,
  Play,
  Square,
  Trash2,
  RefreshCw,
  Users,
  Circle,
} from "lucide-react";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useUIStore } from "../../stores/uiStore";
import * as api from "../../lib/tauri";

interface Instance {
  id: string;
  name: string;
  created_at: string;
  status: string;
  pid: number | null;
}

export function MultiInstance() {
  const { addToast } = useUIStore();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const items = await api.getInstances();
      setInstances(items);
    } catch (e) {
      addToast("error", "Failed to load instances: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const result = await api.createInstance(newName.trim());
      if (result.success) {
        addToast("success", result.message);
        setShowCreateDialog(false);
        setNewName("");
        loadInstances();
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed to create instance: " + String(e));
    }
  };

  const handleLaunch = async (id: string) => {
    setLaunching(id);
    try {
      const result = await api.launchInstance(id);
      if (result.success) {
        addToast("success", result.message);
        loadInstances();
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed to launch: " + String(e));
    } finally {
      setLaunching(null);
    }
  };

  const handleStop = async (id: string) => {
    setStopping(id);
    try {
      const result = await api.stopInstance(id);
      if (result.success) {
        addToast("success", result.message);
        loadInstances();
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed to stop: " + String(e));
    } finally {
      setStopping(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await api.deleteInstance(id);
      if (result.success) {
        addToast("success", result.message);
        loadInstances();
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed to delete: " + String(e));
    }
  };

  const runningCount = instances.filter((i) => i.status === "running").length;

  return (
    <div className="space-y-6">
      <Header
        title="Multi-Instance"
        subtitle="Run multiple Roblox accounts simultaneously"
      />

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-surface-400" />
            <span className="text-sm font-medium text-surface-300">
              {instances.length} instance{instances.length !== 1 ? "s" : ""}
              {runningCount > 0 && (
                <span className="text-green-400 ml-2">
                  ({runningCount} running)
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadInstances}
            >
              <RefreshCw size={14} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus size={14} />
              New Instance
            </Button>
          </div>
        </div>

        {showCreateDialog && (
          <div className="mb-4 p-3 bg-surface-800/50 rounded-xl border border-surface-700/50">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Instance name (e.g. Account 1)"
                className="flex-1 px-3 py-2 text-sm bg-surface-800 border border-surface-600 rounded-xl text-surface-200 placeholder:text-surface-600 focus:outline-none focus:border-brand-500"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim()}
              >
                Create
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowCreateDialog(false); setNewName(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={20} className="text-surface-500 animate-spin" />
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-12">
            <Users size={48} className="text-surface-600 mx-auto mb-3" />
            <p className="text-sm text-surface-500 mb-1">No instances yet</p>
            <p className="text-xs text-surface-600">
              Create an instance to start a separate Roblox session
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between p-3 bg-surface-800/30 border border-surface-700/30 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <Circle
                    size={10}
                    className={
                      instance.status === "running"
                        ? "text-green-400 fill-green-400"
                        : "text-surface-600"
                    }
                  />
                  <div>
                    <p className="text-sm font-medium text-surface-200">
                      {instance.name}
                    </p>
                    <p className="text-[10px] text-surface-600">
                      {instance.status === "running"
                        ? `Running (PID: ${instance.pid})`
                        : "Stopped"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {instance.status === "running" ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleStop(instance.id)}
                      disabled={stopping === instance.id}
                    >
                      {stopping === instance.id ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Square size={12} />
                      )}
                      Stop
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleLaunch(instance.id)}
                      disabled={launching === instance.id}
                    >
                      {launching === instance.id ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                      Launch
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(instance.id)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-surface-100 mb-3">
          How it works
        </h3>
        <ul className="text-xs text-surface-500 space-y-1.5">
          <li>Each instance gets its own isolated data directory</li>
          <li>This allows running multiple Roblox accounts at the same time</li>
          <li>Launch each instance and log in with a different account</li>
          <li>Stop or delete instances when you're done</li>
        </ul>
      </Card>
    </div>
  );
}
