import { useState, useEffect } from "react";
import { History, ChevronDown, ChevronRight } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";

interface UpdateEntry {
  version: string;
  date: string;
  changes: string[];
}

const updates: UpdateEntry[] = [
  {
    version: "1.1.2",
    date: "2026-08-18",
    changes: [
      "Improved Current badge in update log",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-08-18",
    changes: [
      "Added v1.0.9 and v1.1.0 to update log",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-08-18",
    changes: [
      "Fixed Current badge in update log",
    ],
  },
  {
    version: "1.0.9",
    date: "2026-08-18",
    changes: [
      "Fixed single-click drawing in cursor editor",
    ],
  },
  {
    version: "1.0.8",
    date: "2026-08-18",
    changes: [
      "New cursor editor — draw your own crosshairs",
      "Pencil, eraser, fill, and eyedropper tools",
      "Custom color picker with presets",
      "Undo/redo support",
      "Grid overlay for precise editing",
      "Save directly to your crosshair library",
    ],
  },
  {
    version: "1.0.7",
    date: "2026-08-18",
    changes: [
      "Added missing v1.0.6 entry to update log",
    ],
  },
  {
    version: "1.0.6",
    date: "2026-08-18",
    changes: [
      "New Update Log page in sidebar",
      "Smoother premade crosshair previews",
    ],
  },
  {
    version: "1.0.5",
    date: "2026-08-18",
    changes: [
      "Dynamic version display in sidebar and About section",
      "Added tester credit: isni09",
    ],
  },
  {
    version: "1.0.4",
    date: "2026-08-18",
    changes: [
      "Version number now displayed in sidebar",
    ],
  },
  {
    version: "1.0.3",
    date: "2026-08-18",
    changes: [
      "Fixed auto-updater endpoint",
      "Improved premade crosshair preview quality (smoother rendering)",
    ],
  },
  {
    version: "1.0.2",
    date: "2026-08-18",
    changes: [
      "Updated auto-updater configuration",
    ],
  },
  {
    version: "1.0.1",
    date: "2026-08-18",
    changes: [
      "Auto-update support via Tauri updater plugin",
      "Signing key for secure updates",
      "Fixed updater endpoint to correct repository",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-08-17",
    changes: [
      "Initial release",
      "Import, preview, and apply custom crosshairs",
      "Automatic Roblox file backup and restoration",
      "Premade crosshair collection by devy.mm2",
      "Dark/light theme support",
      "Crosshair library with apply/remove/restore",
    ],
  },
];

function UpdateItem({ entry, appVersion, isFirst }: { entry: UpdateEntry; appVersion: string; isFirst: boolean }) {
  const [expanded, setExpanded] = useState(() => appVersion.trim() === entry.version.trim() || (isFirst && !appVersion));

  const isCurrent = appVersion.trim() === entry.version.trim() || (isFirst && appVersion.trim() > entry.version.trim());

  return (
    <div className="border border-surface-800/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-800/30 transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown size={16} className="text-surface-500 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-surface-500 shrink-0" />
        )}
        <span className="text-sm font-semibold text-surface-100">
          v{entry.version}
        </span>
        {isCurrent && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-400 border border-brand-600/20">
            Current
          </span>
        )}
        <span className="text-xs text-surface-600 ml-auto">{entry.date}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pl-10">
          <ul className="space-y-1.5">
            {entry.changes.map((change, i) => (
              <li key={i} className="text-sm text-surface-400 flex items-start gap-2">
                <span className="text-brand-500 mt-1 shrink-0">•</span>
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Updates() {
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <Header title="Update Log" subtitle="Version history and changelogs" />

      <Card className="space-y-0 divide-y divide-surface-800/50">
        <div className="flex items-center gap-2 px-4 py-3">
          <History size={16} className="text-surface-500" />
          <p className="text-xs text-surface-500">
            {updates.length} releases — v{appVersion || "..."}
          </p>
        </div>
        {updates.map((entry, index) => (
          <UpdateItem key={entry.version} entry={entry} appVersion={appVersion} isFirst={index === 0} />
        ))}
      </Card>
    </div>
  );
}
