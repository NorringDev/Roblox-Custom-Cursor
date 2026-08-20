import { useState, useEffect } from "react";
import { Heart, FlaskConical } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";

export function Credits() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <Header title="Credits" subtitle="Who made this app" />

      <Card>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-600/15 flex items-center justify-center shrink-0">
            <Heart size={28} className="text-brand-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-surface-100">Norring</h3>
            <p className="text-sm text-surface-400">
              Developer & Creator
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/15 flex items-center justify-center shrink-0">
            <FlaskConical size={28} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-surface-100">isni09</h3>
            <p className="text-sm text-surface-400">
              Tester
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-100">About</h3>
          <p className="text-sm text-surface-400 leading-relaxed">
            Roblox Modifier is a tool that lets you easily import,
            preview, and apply custom crosshairs to Roblox, customize your
            emote wheel, and run multiple Roblox accounts simultaneously.
            It handles backups and restoration automatically.
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
