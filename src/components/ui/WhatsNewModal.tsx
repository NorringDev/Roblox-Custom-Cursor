import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

interface WhatsNewModalProps {
  open: boolean;
  onClose: () => void;
}

const latestChanges = [
  "Multi-Instance: Run multiple Roblox accounts simultaneously",
  "Renamed to Roblox Modifier",
  "Bug fixes and improvements",
];

export function WhatsNewModal({ open, onClose }: WhatsNewModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-sm bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between p-4 border-b border-surface-700/50">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-brand-400" />
                <h2 className="text-sm font-semibold text-surface-100">
                  What's New in v1.3.0
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4">
              <ul className="space-y-2">
                {latestChanges.map((change, i) => (
                  <li
                    key={i}
                    className="text-sm text-surface-400 flex items-start gap-2"
                  >
                    <span className="text-brand-500 mt-0.5 shrink-0">&#8226;</span>
                    {change}
                  </li>
                ))}
              </ul>
              <button
                onClick={onClose}
                className="mt-4 w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
