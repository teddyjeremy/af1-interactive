import { create } from "zustand";
import { PARTS, type PartId, type PartStyle } from "./parts";
import { PRESETS, cloneDesign, flattenPass, type Design } from "./presets";

export type Mode = "pass" | "bench";
export type CameraPreset = "three" | "side" | "front" | "heel" | "sole" | "top";

type ChamberState = {
  mode: Mode;
  design: Design;
  past: Design[];
  future: Design[];
  edited: boolean;
  selected: PartId[];
  isolated: PartId | null;
  prints: boolean;
  knife: number;
  camera: CameraPreset;
  cameraNonce: number;
  loaded: boolean;
  loadProgress: number;
  notice: string | null;
  reduced: boolean;
  setMode: (mode: Mode, progress?: number) => void;
  select: (ids: PartId[]) => void;
  isolate: (id: PartId | null) => void;
  beginEdit: () => void;
  previewStyle: (patch: Partial<PartStyle>) => void;
  endEdit: () => void;
  applyPreset: (index: number) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  replaceDesign: (design: Design, edited?: boolean) => void;
  setPrints: (prints: boolean) => void;
  setKnife: (knife: number) => void;
  setCamera: (camera: CameraPreset) => void;
  nudgeCamera: () => void;
  setLoad: (progress: number, loaded: boolean) => void;
  setNotice: (notice: string | null) => void;
  setReduced: (reduced: boolean) => void;
};

const LIMIT = 32;
let editFrom: Design | null = null;

function pushHistory(past: Design[], current: Design) {
  return [...past, cloneDesign(current)].slice(-LIMIT);
}

export const useChamber = create<ChamberState>((set, get) => ({
  mode: "pass",
  design: cloneDesign(PRESETS[0]),
  past: [],
  future: [],
  edited: false,
  selected: ["AF1_Quarter"],
  isolated: null,
  prints: false,
  knife: 0,
  camera: "three",
  cameraNonce: 0,
  loaded: false,
  loadProgress: 0,
  notice: null,
  reduced: false,
  setMode: (mode, progress = 0) => {
    if (mode === "bench") {
      const edited = get().edited;
      set({
        mode,
        design: edited ? get().design : flattenPass(progress),
        camera: "three",
        cameraNonce: get().cameraNonce + 1,
      });
      return;
    }
    set({ mode, isolated: null });
  },
  select: (ids) => set({ selected: ids.length ? ids : get().selected }),
  isolate: (id) => set({ isolated: id }),
  beginEdit: () => {
    editFrom = cloneDesign(get().design);
  },
  previewStyle: (patch) => {
    const selected = get().selected;
    if (!selected.length) return;
    const design = cloneDesign(get().design);
    for (const id of selected) {
      design.parts[id] = { ...design.parts[id], ...patch };
    }
    design.name = "Custom";
    set({ design, edited: true });
  },
  endEdit: () => {
    if (!editFrom) return;
    const current = get().design;
    const changed = JSON.stringify(editFrom.parts) !== JSON.stringify(current.parts);
    if (changed) {
      set({ past: pushHistory(get().past, editFrom), future: [] });
    }
    editFrom = null;
  },
  applyPreset: (index) => {
    const preset = PRESETS[index];
    if (!preset) return;
    const current = get().design;
    set({
      past: pushHistory(get().past, current),
      future: [],
      design: cloneDesign(preset),
      edited: true,
      notice: null,
    });
  },
  undo: () => {
    const { past, design, future } = get();
    const previous = past[past.length - 1];
    if (!previous) return;
    set({
      past: past.slice(0, -1),
      future: [cloneDesign(design), ...future].slice(0, LIMIT),
      design: cloneDesign(previous),
      edited: true,
    });
  },
  redo: () => {
    const { past, design, future } = get();
    const next = future[0];
    if (!next) return;
    set({
      future: future.slice(1),
      past: pushHistory(past, design),
      design: cloneDesign(next),
      edited: true,
    });
  },
  reset: () => {
    set({
      past: pushHistory(get().past, get().design),
      future: [],
      design: cloneDesign(PRESETS[0]),
      edited: true,
      isolated: null,
      prints: false,
      knife: 0,
      notice: null,
    });
  },
  replaceDesign: (design, edited = true) => {
    set({
      past: pushHistory(get().past, get().design),
      future: [],
      design: cloneDesign(design),
      edited,
      notice: null,
    });
  },
  setPrints: (prints) => set({ prints }),
  setKnife: (knife) => set({ knife: Math.min(1, Math.max(0, knife)) }),
  setCamera: (camera) => set({ camera, cameraNonce: get().cameraNonce + 1 }),
  nudgeCamera: () => set({ cameraNonce: get().cameraNonce + 1 }),
  setLoad: (loadProgress, loaded) => set({ loadProgress, loaded }),
  setNotice: (notice) => set({ notice }),
  setReduced: (reduced) => set({ reduced }),
}));

export function selectionLabel(selected: PartId[]) {
  if (selected.length === 1) {
    return selected[0];
  }
  const set = new Set(selected);
  if (selected.length === PARTS.length) return "Whole shoe";
  return `${selected.length} panels`;
}
