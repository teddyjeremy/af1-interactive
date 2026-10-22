import { z } from "zod";
import { PARTS, type PartId, type PartStyle } from "./parts";
import { cloneDesign, type Design } from "./presets";

const styleSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  finish: z.enum(["leather", "suede", "patent", "metal", "rubber", "pearl"]),
  treatment: z.enum(["plain", "grain", "halftone", "contour"]),
});

const designSchema = z.object({
  v: z.literal(1),
  name: z.string().min(1).max(48),
  parts: z.record(z.string(), styleSchema),
});

export function designToJson(design: Design) {
  const parts: Record<string, PartStyle> = {};
  for (const id of PARTS) parts[id] = design.parts[id];
  return JSON.stringify({ v: 1, name: design.name, parts }, null, 2);
}

export function parseDesign(raw: unknown): Design {
  const data = designSchema.parse(raw);
  const base = cloneDesign({
    name: data.name,
    parts: Object.fromEntries(
      PARTS.map((id) => [id, { color: "#f3ecdf", finish: "leather", treatment: "plain" }]),
    ) as Record<PartId, PartStyle>,
  });
  for (const id of PARTS) {
    const style = data.parts[id];
    if (style) base.parts[id] = style;
  }
  base.name = data.name;
  return base;
}

export function encodeShare(design: Design) {
  const json = JSON.stringify({
    v: 1,
    name: design.name,
    parts: Object.fromEntries(PARTS.map((id) => [id, design.parts[id]])),
  });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeShare(token: string): Design {
  const padded = token.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((token.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const json = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  return parseDesign(json);
}
