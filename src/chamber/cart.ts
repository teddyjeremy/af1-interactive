import { z } from "zod";
import { parseDesign, designToJson } from "./codec";
import { lineId } from "./pricing";
import { cloneDesign, type Design } from "./presets";

export type CartLine = {
  id: string;
  name: string;
  design: Design;
  prints: boolean;
  size: number;
  qty: number;
};

const sizeSchema = z.union([
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
  z.literal(12),
  z.literal(13),
]);

const storedSchema = z.object({
  v: z.literal(1),
  lines: z.array(
    z.object({
      prints: z.boolean(),
      size: sizeSchema,
      qty: z.number().int().min(1).max(8),
      design: z.unknown(),
    }),
  ),
});

export const CART_KEY = "chamber.cart.v1";

export function readCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const data = storedSchema.parse(JSON.parse(raw));
    const lines: CartLine[] = [];
    for (const row of data.lines) {
      const design = parseDesign(row.design);
      lines.push({
        id: lineId(design, row.prints, row.size),
        name: design.name,
        design,
        prints: row.prints,
        size: row.size,
        qty: row.qty,
      });
    }
    return lines.slice(0, 8);
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      v: 1 as const,
      lines: lines.map((line) => ({
        prints: line.prints,
        size: line.size,
        qty: line.qty,
        design: JSON.parse(designToJson(line.design)) as unknown,
      })),
    };
    window.localStorage.setItem(CART_KEY, JSON.stringify(payload));
  } catch {
    /* a full or blocked store should not stop the bench */
  }
}

export function withLine(lines: CartLine[], design: Design, prints: boolean, size: number) {
  const nextDesign = cloneDesign(design);
  const id = lineId(nextDesign, prints, size);
  const existing = lines.find((line) => line.id === id);
  if (existing) {
    return lines.map((line) =>
      line.id === id ? { ...line, qty: Math.min(8, line.qty + 1) } : line,
    );
  }
  const line: CartLine = {
    id,
    name: nextDesign.name,
    design: nextDesign,
    prints,
    size,
    qty: 1,
  };
  return [line, ...lines].slice(0, 8);
}
