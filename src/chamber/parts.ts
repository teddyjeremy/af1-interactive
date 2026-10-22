export const PARTS = [
  "AF1_Outsole",
  "AF1_Stitching_Sole",
  "AF1_Midsole",
  "AF1_SoleLogo",
  "AF1_Stitching",
  "AF1_Eyelet",
  "AF1_HeelTab",
  "AF1_Swoosh",
  "AF1_Laces",
  "AF1_LeatherOverlay",
  "AF1_Lining",
  "AF1_Vamp",
  "AF1_LaceTip",
  "AF1_Insole",
  "AF1_Tongue",
  "AF1_LaceKeeper",
  "AF1_Collar",
  "AF1_ToeBox",
  "AF1_Out_Lining",
  "AF1_Quarter",
  "AF1_Eyestay",
] as const;

export type PartId = (typeof PARTS)[number];

export type Finish = "leather" | "suede" | "patent" | "metal" | "rubber" | "pearl";
export type Treatment = "plain" | "grain" | "halftone" | "contour";

export type PartStyle = {
  color: string;
  finish: Finish;
  treatment: Treatment;
};

export const FINISHES: Finish[] = ["leather", "suede", "patent", "metal", "rubber", "pearl"];
export const TREATMENTS: Treatment[] = ["plain", "grain", "halftone", "contour"];

export const LABELS: Record<PartId, string> = {
  AF1_Outsole: "Outsole",
  AF1_Stitching_Sole: "Sole stitch",
  AF1_Midsole: "Midsole",
  AF1_SoleLogo: "Sole mark",
  AF1_Stitching: "Upper stitch",
  AF1_Eyelet: "Eyelets",
  AF1_HeelTab: "Heel tab",
  AF1_Swoosh: "Swoosh",
  AF1_Laces: "Laces",
  AF1_LeatherOverlay: "Overlay",
  AF1_Lining: "Lining",
  AF1_Vamp: "Vamp",
  AF1_LaceTip: "Aglets",
  AF1_Insole: "Insole",
  AF1_Tongue: "Tongue",
  AF1_LaceKeeper: "Lace lock",
  AF1_Collar: "Collar",
  AF1_ToeBox: "Toe cap",
  AF1_Out_Lining: "Heel lining",
  AF1_Quarter: "Quarter",
  AF1_Eyestay: "Eyestay",
};

export const PRINT_PARTS = new Set<PartId>([
  "AF1_Stitching",
  "AF1_Laces",
  "AF1_LaceTip",
  "AF1_Insole",
  "AF1_Tongue",
  "AF1_LaceKeeper",
  "AF1_Collar",
]);

export const LAST_HIDDEN = new Set<PartId>([
  "AF1_Stitching",
  "AF1_Stitching_Sole",
  "AF1_Laces",
  "AF1_LaceTip",
  "AF1_LaceKeeper",
  "AF1_Eyelet",
  "AF1_SoleLogo",
]);

export type GroupId =
  | "upper"
  | "toe"
  | "swoosh"
  | "laces"
  | "collar"
  | "tongue"
  | "midsole"
  | "outsole"
  | "stitch"
  | "interior";

export const GROUPS: { id: GroupId; label: string; parts: PartId[] }[] = [
  {
    id: "upper",
    label: "Upper",
    parts: ["AF1_Quarter", "AF1_Vamp", "AF1_Eyestay", "AF1_LeatherOverlay", "AF1_HeelTab", "AF1_Out_Lining", "AF1_Eyelet"],
  },
  { id: "toe", label: "Toe", parts: ["AF1_ToeBox"] },
  { id: "swoosh", label: "Swoosh", parts: ["AF1_Swoosh"] },
  { id: "laces", label: "Laces", parts: ["AF1_Laces", "AF1_LaceTip", "AF1_LaceKeeper"] },
  { id: "collar", label: "Collar", parts: ["AF1_Collar"] },
  { id: "tongue", label: "Tongue", parts: ["AF1_Tongue"] },
  { id: "midsole", label: "Midsole", parts: ["AF1_Midsole"] },
  { id: "outsole", label: "Outsole", parts: ["AF1_Outsole", "AF1_SoleLogo"] },
  { id: "stitch", label: "Stitch", parts: ["AF1_Stitching", "AF1_Stitching_Sole"] },
  { id: "interior", label: "Interior", parts: ["AF1_Lining", "AF1_Insole"] },
];

export function isPartId(value: string): value is PartId {
  return (PARTS as readonly string[]).includes(value);
}

export const SWATCHES = [
  "#f3ecdf",
  "#ff4d1c",
  "#141210",
  "#6eafc9",
  "#1e3d2f",
  "#e0c27a",
  "#c6a07a",
  "#e6e1ea",
  "#0c0c0e",
  "#f4f0e6",
];
