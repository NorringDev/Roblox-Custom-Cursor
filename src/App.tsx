import { useEffect, useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Library } from "./components/library/Library";
import { Premade } from "./components/premade/Premade";
import { Settings } from "./components/settings/Settings";
import { Credits } from "./components/credits/Credits";
import { CursorEditor } from "./components/editor/CursorEditor";
import { ToastContainer } from "./components/ui/Toast";
import { WhatsNewModal } from "./components/ui/WhatsNewModal";
import { useUIStore } from "./stores/uiStore";
import * as api from "./lib/tauri";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

function App() {
  const { currentPage, addToast } = useUIStore();
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const settings = await api.getSettings();
        const html = document.documentElement;
        html.classList.remove("dark", "light");
        html.classList.add(settings.theme);
      } catch {
        document.documentElement.classList.add("dark");
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const CURRENT_VERSION = "1.2.3";
    const lastSeen = localStorage.getItem("whatsnew_version");
    if (lastSeen !== CURRENT_VERSION) {
      setShowWhatsNew(true);
      localStorage.setItem("whatsnew_version", CURRENT_VERSION);
    }
  }, []);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update) {
          addToast("info", `Update available: v${update.version}`);
          await update.downloadAndInstall((event) => {
            if (event.event === "Started") {
              addToast("info", "Downloading update...");
            } else if (event.event === "Progress") {
              // progress tracking
            } else if (event.event === "Finished") {
              addToast("success", "Update downloaded! Restarting...");
            }
          });
          setTimeout(() => {
            relaunch().catch(() => {
              addToast("warning", "Update ready. Please restart the app manually.");
            });
          }, 1500);
        }
      } catch {
        // silently ignore
      }
    };
    checkForUpdates();
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "library":
        return <Library />;
      case "editor":
        return <CursorEditor />;
      case "premade":
        return <Premade />;
      case "settings":
        return <Settings />;
      case "credits":
        return <Credits />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-surface-950 text-surface-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{renderPage()}</main>
      <ToastContainer />
      <WhatsNewModal open={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
    </div>
  );
}

export default App;
