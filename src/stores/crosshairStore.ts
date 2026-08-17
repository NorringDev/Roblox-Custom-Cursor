import { create } from "zustand";

interface CrosshairStore {
  library: { id: string; name: string; path: string; thumbnail: string }[];
  setLibrary: (items: { id: string; name: string; path: string; thumbnail: string }[]) => void;
}

export const useCrosshairStore = create<CrosshairStore>((set) => ({
  library: [],
  setLibrary: (items) => set({ library: items }),
}));
