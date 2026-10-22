# CHAMBER

One sneaker, studied in a dark room. Scroll the pass, then open the bench.

The shoe stays large. The pass moves through the original colourway, a held beam, and vermilion. At the end of the scroll, Bench appears. The same model continues onto the bench, where every named panel can be recoloured.

## Experience

- **Pass.** Scroll, Page Up, or Page Down. The shoe sits in a three quarter view under one spotlight. Bench appears only after the scroll finishes.
- **Bench.** An instrument panel with material, colour, surface, treatment, size, and price. On a phone it stays in a bottom drawer so the shoe keeps the screen. Hide collapses it to the selected panel and its colour.
- **Pass again.** Leaving the bench returns the original shoe and the start of the scroll. Open Bench again and the last edit is still there.
- **Study cart.** Add the pair. Checkout only logs a note. Nothing is charged.
- **Isolate.** Double click a panel to drop everything else into shadow.
- **Construction lab.** Explode the existing named GLB panels, smoothly assemble them, and adjust the separation amount. Blueprint wireframe, hide/show selection, show-all, and adjustable studio lighting are available in the editor.
- **Inspection experiments.** Turntable rotation, a moving inspection-light sweep, and a non-destructive comparison against the original colourway let you inspect the form without losing your custom design.
- **Prints.** Restores the model colour maps on laces, tongue, collar, insole, and stitch.
- **Undo, redo, reset, JSON import and export, a PNG frame, a shareable link, camera presets, fullscreen.**

Designs stay in the browser. Nothing is uploaded.

## Stack

React 19, Vite, TypeScript, Three.js, React Three Fiber, Drei, Zustand, Zod, Tailwind CSS.

## 3D asset

Source file, kept in the study repository: `models/nike shoes.glb` (about 43 MB, ~1.09 million triangles, 21 separately named panels).

Runtime file: `public/models/shoe.glb`.

The runtime mesh is welded, simplified under an error budget, quantized (`KHR_mesh_quantization`), and the shared 2000² normal was resized to 1024. It lands near **243k triangles** and **9.5 MB**. Panel names are the glTF node names (`AF1_Quarter`, `AF1_Swoosh`, `AF1_Midsole`, and the rest). Each panel keeps its normal map. Colour maps are turned off by default so a preset colour reads cleanly, and can be restored with Prints.

Treatments are a small shader on the physical material. They sample world position, not the model’s UVs, because several UV sets fall outside 0 to 1 and would smear a printed pattern.

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

The app is a Vite project. Publish with the connected Vercel project. The shoe is a static file under `public/models`, so the host must allow a ~12 MB asset.

## Limits

- Simplification can open hairline gaps between panels that were modeled as separate shells.
- World-space grain and halftone do not follow the leather’s UV islands.
- The original printed insole and tongue graphics are hidden until Prints is on.
- The study model carries a swoosh. This is a lighting and material study, not a Nike storefront, and the asset’s usage rights stay with the repository owner.
- A share link encodes the design in the URL hash. Very long links depend on the browser.
