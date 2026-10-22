import { PARTS, SWATCHES, type PartId, type PartStyle } from "./parts";
import type { Design } from "./presets";

/** Last and labour. Material shares sit on top, so the pair moves with each panel. */
const LAST = 64;

const SHARE: Record<PartId, number> = {
  AF1_Quarter: 12,
  AF1_Vamp: 8,
  AF1_Eyestay: 4,
  AF1_LeatherOverlay: 4,
  AF1_HeelTab: 3,
  AF1_Out_Lining: 2,
  AF1_Eyelet: 3,
  AF1_ToeBox: 6,
  AF1_Swoosh: 9,
  AF1_Laces: 4,
  AF1_LaceTip: 1,
  AF1_LaceKeeper: 1,
  AF1_Collar: 4,
  AF1_Tongue: 4,
  AF1_Midsole: 7,
  AF1_Outsole: 6,
  AF1_SoleLogo: 2,
  AF1_Stitching: 2,
  AF1_Stitching_Sole: 1,
  AF1_Lining: 3,
  AF1_Insole: 2,
};

const FINISH_MULT: Record<PartStyle["finish"], number> = {
  leather: 1,
  rubber: 0.8,
  suede: 1.35,
  metal: 1.4,
  patent: 1.55,
  pearl: 1.7,
};

const TREAT_ADD: Record<PartStyle["treatment"], number> = {
  plain: 0,
  grain: 1,
  contour: 2,
  halftone: 2,
};

export const PRINTS_FEE = 16;
export const PIGMENT_FEE = 12;

const SWATCH_SET = new Set(SWATCHES.map((color) => color.toLowerCase()));

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function partPrice(style: PartStyle, id: PartId) {
  return Math.round(SHARE[id] * FINISH_MULT[style.finish]) + TREAT_ADD[style.treatment];
}

export function selectionPrice(design: Design, selected: PartId[]) {
  return selected.reduce((sum, id) => sum + partPrice(design.parts[id], id), 0);
}

export function hasAtelierPigment(design: Design) {
  return PARTS.some((id) => !SWATCH_SET.has(design.parts[id].color.toLowerCase()));
}

export const SIZES = [7, 8, 9, 10, 11, 12, 13] as const;

/** Larger sizes cost more leather and a different last. */
const SIZE_ADD: Record<(typeof SIZES)[number], number> = {
  7: 0,
  8: 0,
  9: 0,
  10: 6,
  11: 10,
  12: 14,
  13: 18,
};

export function sizeAdd(size: number) {
  return SIZE_ADD[size as (typeof SIZES)[number]] ?? 0;
}

export function pairPrice(design: Design, prints: boolean, size = 9) {
  const materials = PARTS.reduce((sum, id) => sum + partPrice(design.parts[id], id), 0);
  return LAST + materials + (prints ? PRINTS_FEE : 0) + (hasAtelierPigment(design) ? PIGMENT_FEE : 0) + sizeAdd(size);
}

export function lineId(design: Design, prints: boolean, size: number) {
  const body = PARTS.map((id) => {
    const part = design.parts[id];
    return `${id}:${part.color}:${part.finish}:${part.treatment}`;
  }).join("|");
  return `${size}:${prints ? "p" : "n"}:${body}`;
}
