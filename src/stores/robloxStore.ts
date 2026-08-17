import { create } from "zustand";
import type { RobloxStatus } from "../types";
import * as api from "../lib/tauri";

interface RobloxStore {
  status: RobloxStatus | null;
  loading: boolean;
  error: string | null;
  detect: () => Promise<void>;
}

export const useRobloxStore = create<RobloxStore>((set) => ({
  status: null,
  loading: false,
  error: null,
  detect: async () => {
    set({ loading: true, error: null });
    try {
      const status = await api.detectRoblox();
      set({ status, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
