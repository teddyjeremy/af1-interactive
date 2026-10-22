import { create } from "zustand";
import { z } from "zod";
import { designToJson, parseDesign } from "./codec";
import { CART_KEY, readCart, withLine, writeCart, type CartLine } from "./cart";
import { SIZES } from "./pricing";
import { PARTS, type PartId, type PartStyle } from "./parts";
import { PRESETS, cloneDesign, flattenPass, type Design } from "./presets";

export type Mode = "pass" | "bench";
export type CameraPreset = "three" | "side" | "front" | "heel" | "sole" | "top";

export type StudyOrder = {
  code: string;
  buyer: string;
  total: number;
  count: number;
};

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
  size: (typeof SIZES)[number];
  cart: CartLine[];
  cartOpen: boolean;
  order: StudyOrder | null;
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
  setSize: (size: (typeof SIZES)[number]) => void;
  hydrateCart: () => void;
  addToCart: () => void;
  setQty: (id: string, qty: number) => void;
  removeLine: (id: string) => void;
  setCartOpen: (open: boolean) => void;
  placeStudy: (buyer: string, total: number) => void;
  clearOrder: () => void;
  hydrateStudy: () => void;
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
  size: 9,
  cart: [],
  cartOpen: false,
  order: null,
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
      edited: false,
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
  setSize: (size) => set({ size }),
  hydrateCart: () => {
    if (typeof window === "undefined") return;
    set({ cart: readCart(window.localStorage.getItem(CART_KEY)) });
  },
  addToCart: () => {
    const { design, prints, size, cart } = get();
    const next = withLine(cart, design, prints, size);
    writeCart(next);
    set({
      cart: next,
      cartOpen: true,
      order: null,
      notice: `${design.name} · US ${size} is in the cart.`,
    });
  },
  setQty: (id, qty) => {
    const next =
      qty < 1
        ? get().cart.filter((line) => line.id !== id)
        : get().cart.map((line) => (line.id === id ? { ...line, qty: Math.min(8, qty) } : line));
    writeCart(next);
    set({ cart: next });
  },
  removeLine: (id) => {
    const next = get().cart.filter((line) => line.id !== id);
    writeCart(next);
    set({ cart: next });
  },
  setCartOpen: (cartOpen) => set({ cartOpen }),
  placeStudy: (buyer, total) => {
    const count = get().cart.reduce((sum, line) => sum + line.qty, 0);
    if (!count) return;
    const code = `CH-${Math.floor(1000 + Math.random() * 9000)}`;
    writeCart([]);
    set({
      cart: [],
      order: { code, buyer, total, count },
      cartOpen: true,
      notice: null,
    });
  },
  clearOrder: () => set({ order: null, cartOpen: false }),
  hydrateStudy: () => {
    if (typeof window === "undefined") return;
    const saved = readStudy(window.localStorage.getItem(STUDY_KEY));
    if (!saved) return;
    set({
      design: saved.design,
      prints: saved.prints,
      size: saved.size,
      edited: saved.edited,
    });
  },
}));

export function selectionLabel(selected: PartId[]) {
  if (selected.length === 1) {
    return selected[0];
  }
  const set = new Set(selected);
  if (selected.length === PARTS.length) return "Whole shoe";
  return `${selected.length} panels`;
}

export const STUDY_KEY = "chamber.study.v1";

const studySchema = z.object({
  v: z.literal(1),
  edited: z.boolean(),
  prints: z.boolean(),
  size: z.number(),
  design: z.unknown(),
});

export function readStudy(raw: string | null) {
  if (!raw) return null;
  try {
    const data = studySchema.parse(JSON.parse(raw));
    if (!(SIZES as readonly number[]).includes(data.size)) return null;
    return {
      edited: data.edited,
      prints: data.prints,
      size: data.size as (typeof SIZES)[number],
      design: parseDesign(data.design),
    };
  } catch {
    return null;
  }
}

export function writeStudy(state: {
  design: Design;
  prints: boolean;
  size: (typeof SIZES)[number];
  edited: boolean;
}) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STUDY_KEY,
      JSON.stringify({
        v: 1,
        edited: state.edited,
        prints: state.prints,
        size: state.size,
        design: JSON.parse(designToJson(state.design)) as unknown,
      }),
    );
  } catch {
    /* a full store should not stop the bench */
  }
}
