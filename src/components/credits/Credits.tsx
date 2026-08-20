import { useState, useEffect } from "react";
import { Heart, ExternalLink } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";

export function Credits() {
  const [version, setVersion] = useState("");
  const [showDiscord, setShowDiscord] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const copyDiscord = () => {
    navigator.clipboard.writeText("norring").then(() => {
      setShowDiscord(true);
      setTimeout(() => setShowDiscord(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <Header title="Credits" subtitle="Who made this app" />

      <Card>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-600/15 flex items-center justify-center shrink-0">
            <Heart size={28} className="text-brand-400" />
          </div>
          <div>
            <button
              onClick={copyDiscord}
              className="text-lg font-bold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer flex items-center gap-2"
            >
              Norring
              <ExternalLink size={14} className="text-surface-500" />
            </button>
            <p className="text-sm text-surface-400">
              Developer & Creator
            </p>
            {showDiscord && (
              <p className="text-xs text-green-400 mt-1">
                Discord username copied: norring
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-100">About</h3>
          <p className="text-sm text-surface-400 leading-relaxed">
            Roblox Modifier is a tool that lets you easily import,
            preview, and apply custom crosshairs to Roblox, customize your
            emote wheel, and more. It handles backups and restoration automatically.
          </p>
          <div className="flex items-center gap-2 text-xs text-surface-600 pt-2">
            <span>Built with</span>
            <span className="text-surface-500">Tauri</span>
            <span>+</span>
            <span className="text-surface-500">React</span>
            <span>+</span>
            <span className="text-surface-500">Rust</span>
          </div>
          <p className="text-xs text-surface-600">Version {version}</p>
        </div>
      </Card>
    </div>
  );
}
