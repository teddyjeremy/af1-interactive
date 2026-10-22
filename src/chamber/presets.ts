import {
  PARTS,
  type Finish,
  type PartId,
  type PartStyle,
  type Treatment,
} from "./parts";

export type Design = {
  name: string;
  parts: Record<PartId, PartStyle>;
};

const UPPER: PartId[] = [
  "AF1_Quarter",
  "AF1_Vamp",
  "AF1_Eyestay",
  "AF1_LeatherOverlay",
  "AF1_HeelTab",
  "AF1_Out_Lining",
];

function paint(
  name: string,
  rules: { parts: PartId[]; color: string; finish: Finish; treatment?: Treatment }[],
): Design {
  const parts = {} as Record<PartId, PartStyle>;
  for (const id of PARTS) {
    parts[id] = { color: "#f3ecdf", finish: "leather", treatment: "plain" };
  }
  for (const rule of rules) {
    for (const id of rule.parts) {
      parts[id] = {
        color: rule.color,
        finish: rule.finish,
        treatment: rule.treatment ?? "plain",
      };
    }
  }
  return { name, parts };
}

export const UNIVERSITY = paint("University", [
  { parts: [...UPPER, "AF1_Swoosh", "AF1_Eyelet", "AF1_SoleLogo"], color: "#6eafc9", finish: "leather" },
  { parts: ["AF1_ToeBox", "AF1_Midsole", "AF1_Outsole", "AF1_Lining"], color: "#f3f0e8", finish: "rubber" },
  { parts: ["AF1_Collar", "AF1_Tongue", "AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper", "AF1_Insole"], color: "#f7f4ee", finish: "leather" },
  { parts: ["AF1_Stitching", "AF1_Stitching_Sole"], color: "#e7e2d8", finish: "leather" },
]);

export const PRESETS: Design[] = [
  UNIVERSITY,
  paint("Court", [
    { parts: [...UPPER, "AF1_ToeBox", "AF1_Collar", "AF1_Tongue", "AF1_Lining"], color: "#f4f0e6", finish: "leather" },
    { parts: ["AF1_Swoosh", "AF1_SoleLogo", "AF1_Outsole"], color: "#161616", finish: "leather" },
    { parts: ["AF1_Midsole", "AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper", "AF1_Insole"], color: "#f7f4ee", finish: "rubber" },
    { parts: ["AF1_Eyelet"], color: "#d9d3c7", finish: "metal" },
    { parts: ["AF1_Stitching", "AF1_Stitching_Sole"], color: "#ded8cc", finish: "leather" },
  ]),
  paint("Carbon", [
    { parts: [...UPPER, "AF1_ToeBox", "AF1_Collar", "AF1_Tongue", "AF1_Lining", "AF1_Insole"], color: "#141414", finish: "leather" },
    { parts: ["AF1_Swoosh", "AF1_SoleLogo"], color: "#b9b3a8", finish: "metal" },
    { parts: ["AF1_Midsole"], color: "#1c1c1c", finish: "rubber" },
    { parts: ["AF1_Outsole"], color: "#0e0e0e", finish: "rubber" },
    { parts: ["AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper"], color: "#2a2a2a", finish: "leather" },
    { parts: ["AF1_Eyelet"], color: "#8d8d90", finish: "metal" },
    { parts: ["AF1_Stitching", "AF1_Stitching_Sole"], color: "#3a3a3a", finish: "leather" },
  ]),
  paint("Vermilion", [
    { parts: [...UPPER, "AF1_ToeBox", "AF1_Tongue"], color: "#ff4d1c", finish: "leather" },
    { parts: ["AF1_Swoosh", "AF1_Collar", "AF1_Outsole", "AF1_Eyelet"], color: "#1a120f", finish: "leather" },
    { parts: ["AF1_Midsole", "AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper", "AF1_Lining", "AF1_Insole"], color: "#f3ecdf", finish: "rubber" },
    { parts: ["AF1_Stitching", "AF1_Stitching_Sole", "AF1_SoleLogo"], color: "#f3ecdf", finish: "leather" },
  ]),
  paint("Night garden", [
    { parts: [...UPPER, "AF1_ToeBox"], color: "#1e3d2f", finish: "suede" },
    { parts: ["AF1_Collar"], color: "#163028", finish: "suede" },
    { parts: ["AF1_Swoosh", "AF1_Eyelet", "AF1_SoleLogo"], color: "#e0c27a", finish: "metal" },
    { parts: ["AF1_Midsole", "AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper", "AF1_Tongue", "AF1_Insole"], color: "#efe6d4", finish: "leather" },
    { parts: ["AF1_Outsole"], color: "#1a1712", finish: "rubber" },
    { parts: ["AF1_Lining"], color: "#14261c", finish: "suede" },
    { parts: ["AF1_Stitching", "AF1_Stitching_Sole"], color: "#c4b48a", finish: "leather" },
  ]),
  paint("Patent ink", [
    { parts: [...UPPER, "AF1_ToeBox", "AF1_Collar", "AF1_Tongue", "AF1_SoleLogo"], color: "#0c0c0e", finish: "patent" },
    { parts: ["AF1_Swoosh", "AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper", "AF1_Stitching", "AF1_Stitching_Sole"], color: "#f3ecdf", finish: "patent" },
    { parts: ["AF1_Midsole", "AF1_Insole", "AF1_Lining"], color: "#f3ecdf", finish: "rubber" },
    { parts: ["AF1_Outsole"], color: "#101010", finish: "rubber" },
    { parts: ["AF1_Eyelet"], color: "#c0c0c4", finish: "metal" },
  ]),
  paint("Halftone", [
    { parts: [...UPPER, "AF1_ToeBox"], color: "#f3ecdf", finish: "leather", treatment: "halftone" },
    { parts: ["AF1_Collar"], color: "#f3ecdf", finish: "leather", treatment: "grain" },
    { parts: ["AF1_Swoosh", "AF1_Eyelet", "AF1_SoleLogo", "AF1_Stitching", "AF1_Stitching_Sole"], color: "#ff4d1c", finish: "leather" },
    { parts: ["AF1_Midsole"], color: "#f3ecdf", finish: "rubber", treatment: "contour" },
    { parts: ["AF1_Outsole", "AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper"], color: "#141210", finish: "rubber" },
    { parts: ["AF1_Tongue", "AF1_Lining", "AF1_Insole"], color: "#f3ecdf", finish: "leather" },
  ]),
  paint("Pearl shell", [
    { parts: [...UPPER, "AF1_ToeBox", "AF1_Collar", "AF1_Tongue"], color: "#e6e1ea", finish: "pearl" },
    { parts: ["AF1_Swoosh", "AF1_SoleLogo", "AF1_Stitching", "AF1_Stitching_Sole"], color: "#2c2638", finish: "metal" },
    { parts: ["AF1_Midsole", "AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper", "AF1_Lining", "AF1_Insole"], color: "#f6f1e8", finish: "leather" },
    { parts: ["AF1_Outsole"], color: "#c6a07a", finish: "rubber" },
    { parts: ["AF1_Eyelet"], color: "#d8d2c6", finish: "metal" },
  ]),
];

/** Internal pass state: the swoosh held in the beam, the rest dropped. */
export const BEAM = paint("In the beam", [
  { parts: [...UPPER, "AF1_ToeBox", "AF1_Collar", "AF1_Tongue", "AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper", "AF1_Lining", "AF1_Insole", "AF1_Outsole", "AF1_Midsole", "AF1_Stitching", "AF1_Stitching_Sole", "AF1_SoleLogo", "AF1_LeatherOverlay"], color: "#100e0c", finish: "leather" },
  { parts: ["AF1_Swoosh"], color: "#f4efe6", finish: "leather" },
  { parts: ["AF1_Eyelet"], color: "#c8c2b8", finish: "metal" },
]);

export function cloneDesign(design: Design): Design {
  return {
    name: design.name,
    parts: Object.fromEntries(
      PARTS.map((id) => [id, { ...design.parts[id] }]),
    ) as Record<PartId, PartStyle>,
  };
}

function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function passPair(progress: number): { from: Design; to: Design; t: number } {
  const p = Math.min(1, Math.max(0, progress));
  const vermilion = PRESETS[3];
  if (p < 0.22) return { from: UNIVERSITY, to: UNIVERSITY, t: 0 };
  if (p < 0.46) return { from: UNIVERSITY, to: BEAM, t: smooth((p - 0.22) / 0.24) };
  if (p < 0.58) return { from: BEAM, to: BEAM, t: 0 };
  if (p < 0.82) return { from: BEAM, to: vermilion, t: smooth((p - 0.58) / 0.24) };
  return { from: vermilion, to: vermilion, t: 0 };
}

export function mixHex(a: string, b: string, t: number) {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const channel = (shift: number) => {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t);
  };
  const r = channel(16);
  const g = channel(8);
  const bl = channel(0);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function flattenPass(progress: number): Design {
  const { from, to, t } = passPair(progress);
  const parts = {} as Record<PartId, PartStyle>;
  for (const id of PARTS) {
    const a = from.parts[id];
    const b = to.parts[id];
    parts[id] = {
      color: mixHex(a.color, b.color, t),
      finish: t < 0.5 ? a.finish : b.finish,
      treatment: t < 0.5 ? a.treatment : b.treatment,
    };
  }
  return { name: t < 0.5 ? from.name : to.name, parts };
}
