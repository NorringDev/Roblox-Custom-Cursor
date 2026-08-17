import { create } from "zustand";
import type { Toast, ToastType } from "../types";
import { generateId } from "../lib/utils";

interface UIStore {
  currentPage: string;
  toasts: Toast[];
  setPage: (page: string) => void;
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  currentPage: "dashboard",
  toasts: [],
  setPage: (page) => set({ currentPage: page }),
  addToast: (type, message, duration = 4000) => {
    const id = generateId();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
