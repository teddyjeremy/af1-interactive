# CHAMBER

A last, held in light.

CHAMBER is an optical study of one sneaker, not a storefront. The shoe stays large. Scroll moves the room through five states — hold, seam, mark, pigment, bench — and the same model continues onto the bench, where every named panel can be recoloured.

## Experience

- **Pass.** Scroll progress drives the camera, the lights, and the material state in both directions. Five chapters: the shoe held in a beam, the sole, the swoosh isolated, pigment flooding the leather, then the bench.
- **Bench.** Click a panel or a group. Set colour, finish (leather, suede, patent, metal, rubber, pearl), and a world-space surface treatment (grain, halftone, contour). Eight presets change the shoe itself: University, Court, Carbon, Vermilion, Night garden, Patent ink, Halftone, Pearl shell.
- **The knife.** A vertical cut tied to the camera. Drag it and the shell opens onto the last — the wooden form inside the shoe. The inner form is not drawn until the knife moves.
- **Isolate.** Double-click a panel to drop everything else into shadow.
- **Prints.** Restores the model’s original colour maps on laces, tongue, collar, insole, and stitch.
- **Undo, redo, reset, JSON import/export, PNG frame, shareable link, camera presets, fullscreen.**

Designs stay in the browser. Nothing is uploaded.

## Stack

React 19, TypeScript, Vite, Three.js, React Three Fiber, Drei, Zustand, Zod, Tailwind CSS.

## 3D asset

Source file: `models/nike shoes.glb` (about 43 MB, ~1.09 million triangles, 21 separately named panels).

Runtime file: `public/models/shoe.glb`.

The runtime mesh is welded, simplified under an error budget, and quantized (`KHR_mesh_quantization`). The shared 2000² normal was resized to 1024. It lands near **243k triangles** and **9.5 MB**. Panel names are the glTF node names (`AF1_Quarter`, `AF1_Swoosh`, `AF1_Midsole`, and the rest). Each panel keeps its normal map. Colour maps are off by default so a preset colour reads cleanly, and can be restored with Prints.

Treatments are a shader on the physical material. They sample world position, not the model’s UVs, because several UV sets fall outside 0–1 and would smear a printed pattern.

The knife uses two clipping planes: the shell, and a slightly inset wooden duplicate. Stitches and laces are hidden on the last so the core reads as a solid form.

## Run

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm run preview
```

## Deploy

The repo is a Vite single-page app. `vercel.json` rewrites every path to `index.html`. Push to `main` on the linked Vercel project. The shoe is a static file under `public/models` (~9.5 MB).

## Limits

- Simplification can open hairline gaps between panels that were modeled as separate shells.
- World-space grain and halftone do not follow the leather’s UV islands.
- Printed insole and tongue graphics stay hidden until Prints is on.
- The study model carries a swoosh. This is a lighting and material study, not a storefront. Usage rights for the asset stay with the repository owner.
- A share link encodes the design in the URL hash.
