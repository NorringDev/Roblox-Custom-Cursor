import { useEffect, useState } from "react";
import {
  Upload,
  Trash2,
  Edit3,
  Crosshair as CrosshairIcon,
  Plus,
  FolderOpen,
  CheckCircle,
  Trash,
} from "lucide-react";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { useCrosshairStore } from "../../stores/crosshairStore";
import { useUIStore } from "../../stores/uiStore";
import * as api from "../../lib/tauri";
import { convertFileSrc } from "@tauri-apps/api/core";

export function Library() {
  const { library, setLibrary } = useCrosshairStore();
  const { addToast } = useUIStore();
  const [importModal, setImportModal] = useState(false);
  const [importName, setImportName] = useState("");
  const [importFile, setImportFile] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [clearModal, setClearModal] = useState(false);
  const [renameModal, setRenameModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [activeCrosshairId, setActiveCrosshairId] = useState<string | null>(null);

  useEffect(() => {
    loadLibrary();
    loadActiveCrosshairId();
  }, []);

  const loadLibrary = async () => {
    try {
      const items = await api.getLibrary();
      setLibrary(items);
    } catch (e) {
      console.error("Failed to load library:", e);
    }
  };

  const loadActiveCrosshairId = async () => {
    try {
      const settings = await api.getSettings();
      setActiveCrosshairId(settings.activeCrosshairId);
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  };

  const handleSelectFile = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp"],
          },
        ],
      });

      if (!selected) return;

      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return;

      setImportFile(path);
      setValidationResult(null);

      if (!importName) {
        const fileName = path.split(/[/\\]/).pop() || "";
        setImportName(fileName.replace(/\.[^.]+$/, ""));
      }

      try {
        const validation = await api.validateImage(path);
        setValidationResult({
          valid: validation.valid,
          message: validation.message,
        });
      } catch (e) {
        setValidationResult({ valid: true, message: "Ready to import" });
      }
    } catch (e) {
      addToast("error", "Failed to open file dialog: " + String(e));
    }
  };

  const handleImport = async () => {
    if (!importFile || !importName.trim()) {
      addToast("warning", "Please select a file and enter a name.");
      return;
    }
    setImporting(true);
    try {
      const result = await api.importCrosshair(importFile, importName.trim());
      if (result.success) {
        addToast("success", `"${importName}" imported successfully!`);
        setImportModal(false);
        setImportFile(null);
        setImportName("");
        setValidationResult(null);
        loadLibrary();
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Import failed: " + String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await api.deleteLibraryItem(deleteModal.id);
      addToast("success", `"${deleteModal.name}" deleted.`);
      setDeleteModal(null);
      loadLibrary();
    } catch (e) {
      addToast("error", "Delete failed: " + String(e));
    }
  };

  const handleRename = async () => {
    if (!renameModal || !renameValue.trim()) return;
    try {
      await api.renameLibraryItem(renameModal.id, renameValue.trim());
      addToast("success", "Renamed successfully!");
      setRenameModal(null);
      loadLibrary();
    } catch (e) {
      addToast("error", "Rename failed: " + String(e));
    }
  };

  const handleApplyFromLibrary = async (item: {
    id: string;
    name: string;
    path: string;
  }) => {
    try {
      const result = await api.applyCrosshair(item.id, item.path);
      if (result.success) {
        addToast("success", `"${item.name}" applied successfully!`);
        setActiveCrosshairId(item.id);
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Apply failed: " + String(e));
    }
  };

  const toAssetUrl = (filePath: string) => {
    try {
      return convertFileSrc(filePath);
    } catch {
      return "";
    }
  };

  const handleClearAll = async () => {
    try {
      const result = await api.clearLibrary();
      addToast("success", result.message);
      setClearModal(false);
      setLibrary([]);
    } catch (e) {
      addToast("error", "Clear failed: " + String(e));
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title="My Crosshairs"
        subtitle="Your imported crosshair collection"
        actions={
          <div className="flex gap-2">
            {library.length > 0 && (
              <Button variant="danger" size="sm" onClick={() => setClearModal(true)}>
                <Trash size={14} />
                Clear All
              </Button>
            )}
            <Button onClick={() => setImportModal(true)}>
              <Plus size={16} />
              Import Crosshair
            </Button>
          </div>
        }
      />

      {library.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
            <FolderOpen size={32} className="text-surface-600" />
          </div>
          <h3 className="text-base font-semibold text-surface-300 mb-1">
            No crosshairs yet
          </h3>
          <p className="text-sm text-surface-500 mb-4">
            Import your first custom crosshair to get started.
          </p>
          <Button onClick={() => setImportModal(true)}>
            <Upload size={16} />
            Import Crosshair
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {library.map((item) => (
            <Card key={item.id} hover>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-surface-950 border border-surface-800 flex items-center justify-center overflow-hidden p-1">
                    {item.path ? (
                      <img
                        src={toAssetUrl(item.path)}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                    ) : (
                      <CrosshairIcon size={18} className="text-brand-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-100">
                      {item.name}
                    </h3>
                  </div>
                </div>
                {activeCrosshairId === item.id && (
                  <Badge variant="success">Active</Badge>
                )}
              </div>

              <div className="w-full h-24 rounded-lg bg-surface-950 border border-surface-800 flex items-center justify-center mb-3 p-4">
                {item.path ? (
                  <img
                    src={toAssetUrl(item.path)}
                    alt={item.name}
                    className="w-16 h-16 object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <CrosshairIcon size={28} className="text-surface-500" />
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setRenameModal({ id: item.id, name: item.name });
                    setRenameValue(item.name);
                  }}
                >
                  <Edit3 size={12} />
                  Rename
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleApplyFromLibrary(item)}
                >
                  Apply
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    setDeleteModal({ id: item.id, name: item.name })
                  }
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Import Modal */}
      <Modal
        open={importModal}
        onClose={() => {
          setImportModal(false);
          setImportFile(null);
          setImportName("");
          setValidationResult(null);
        }}
        title="Import Crosshair"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Crosshair Name
            </label>
            <input
              type="text"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder="My Custom Crosshair"
              className="w-full px-3 py-2 bg-surface-950 border border-surface-700/50 rounded-xl text-sm text-surface-200 placeholder:text-surface-600 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Image File
            </label>
            <div
              onClick={handleSelectFile}
              className="w-full p-6 border-2 border-dashed border-surface-700 rounded-xl text-center cursor-pointer hover:border-brand-600/50 hover:bg-surface-800/50 transition-colors"
            >
              {importFile ? (
                <div className="space-y-2">
                  <div className="w-20 h-20 mx-auto rounded-lg bg-surface-800 flex items-center justify-center overflow-hidden">
                    <img
                      src={convertFileSrc(importFile)}
                      alt="Preview"
                      className="w-16 h-16 object-contain"
                      style={{ imageRendering: "pixelated" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                  <p className="text-sm text-surface-300 truncate max-w-xs mx-auto">
                    {importFile.split(/[/\\]/).pop()}
                  </p>
                  <p className="text-xs text-surface-500">
                    Click to change file
                  </p>
                </div>
              ) : (
                <div>
                  <Upload
                    size={24}
                    className="mx-auto text-surface-500 mb-2"
                  />
                  <p className="text-sm text-surface-400">
                    Click to select a crosshair image
                  </p>
                  <p className="text-xs text-surface-600 mt-1">
                    PNG, JPG, JPEG, or WEBP
                  </p>
                </div>
              )}
            </div>
          </div>

          {validationResult && (
            <div
              className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
                validationResult.valid
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
              }`}
            >
              <CheckCircle size={14} className="mt-0.5 shrink-0" />
              <span>{validationResult.message}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setImportModal(false);
                setImportFile(null);
                setImportName("");
                setValidationResult(null);
              }}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleImport}
              disabled={importing || !importFile || !importName.trim()}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Crosshair"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300 text-center">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-surface-100">
              {deleteModal?.name}
            </span>
            ?
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteModal(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal
        open={!!renameModal}
        onClose={() => setRenameModal(null)}
        title="Rename Crosshair"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full px-3 py-2 bg-surface-950 border border-surface-700/50 rounded-xl text-sm text-surface-200 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/20"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setRenameModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleRename}
              disabled={!renameValue.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear All Modal */}
      <Modal
        open={clearModal}
        onClose={() => setClearModal(false)}
        title="Clear Library"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300 text-center">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-surface-100">
              all {library.length} crosshairs
            </span>
            ?
          </p>
          <p className="text-xs text-surface-500 text-center">
            This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setClearModal(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleClearAll}>
              Delete All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
