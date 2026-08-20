import { useState, useEffect } from "react";
import { Heart, Copy, Check } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";

export function Credits() {
  const [version, setVersion] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText("norring").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
              onClick={() => setShowModal(true)}
              className="text-lg font-bold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
            >
              Norring
            </button>
            <p className="text-sm text-surface-400">
              Developer & Creator
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

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-brand-600/15 flex items-center justify-center">
                <Heart size={22} className="text-brand-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-surface-100">Norring</h3>
                <p className="text-xs text-surface-500">Developer & Creator</p>
              </div>
            </div>

            <div className="bg-surface-800/50 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-0.5">Discord</p>
                <p className="text-sm font-medium text-surface-200">norring</p>
              </div>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg hover:bg-surface-700 transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check size={16} className="text-green-400" />
                ) : (
                  <Copy size={16} className="text-surface-400" />
                )}
              </button>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
