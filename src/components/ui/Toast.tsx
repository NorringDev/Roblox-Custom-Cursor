import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import type { ToastType } from "../../types";

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors: Record<ToastType, string> = {
  success:
    "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  error: "bg-red-500/10 border-red-500/30 text-red-400",
  info: "bg-brand-500/10 border-brand-500/30 text-brand-400",
  warning:
    "bg-amber-500/10 border-amber-500/30 text-amber-400",
};

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg ${colors[toast.type]}`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
