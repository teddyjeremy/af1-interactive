# AF1 Interactive — Make Your Mark

A scroll-led, interactive 3D sneaker playground built around one GLB asset. The same sneaker appears in the cinematic experience and the customization studio.

## Stack

- React 19, TypeScript, Vite
- Three.js through React Three Fiber
- Drei for GLTF loading, environment lighting, orbit controls, floating motion and contact shadows
- GSAP is installed for future scroll choreography
- Lucide React icons
- Vercel SPA rewrite configuration

## Run locally

```bash
npm install
npm run dev
```

Build and preview the production bundle:

```bash
npm run build
npm run preview
```

## 3D asset and loading

- Repository asset: `models/nike shoes.glb`
- File size reported by GitHub: **42,851,124 bytes** (about 42.9 MB decimal).
- The runtime currently loads the model from the raw GitHub URL for this repository. This avoids referencing a root-level `models/` folder as if it were a Vite `public/` directory.
- Drei's `useGLTF` cache is used for model loading.
- At runtime, the scene is cloned before editable materials are changed. The original cached GLB materials are not directly recoloured.
- The viewer calculates the GLB's bounding box, recentres the clone, and normalizes its maximum dimension before rendering. This makes framing more reliable when the source model's export units or origin are unexpected.
- The model's real mesh and material names are discovered at runtime and shown in the parts list. Exact mesh counts, UV quality, triangle counts and texture inventory have not been independently audited yet; do not assume that every visible shoe region is a separate mesh.

## Presets and customization

Six shared preset definitions are maintained in `src/Experience.tsx`: Chrome Bloom, Acid Garden, Blue Hour, Sunset Club, Digital Camo and Grape Soda. The homepage cards and studio read from these definitions.

The material colour is changed on cloned materials, with the existing material colour retained as a multiplier. This can preserve texture detail, but the appearance depends on the source material's texture and base tint. A combined mesh cannot provide arbitrary independently editable surface regions without suitable separate geometry, material assignments or UV masks.

The current studio supports runtime mesh discovery, preset selection, per-mesh colour overrides, five camera views, camera reset by reselecting a view, fullscreen viewport, physically based matte/satin/gloss/high-gloss/metallic finish settings, undo/redo history, and versioned JSON import/export with validation. The spectrum-palette option recolours the actual shoe meshes with a coordinated multicolour palette. Finish and palette state are included in design history and JSON export.

## Current limitations

- The GLB has not yet had a full binary asset audit. Mesh hierarchy, UV coverage, texture maps, polygon counts and independent material regions still need to be inspected in a dedicated GLB viewer or asset-analysis script.
- The liquid-drip and paint-splatter controls are intentionally disabled because the asset's UV layout and region masks have not yet been audited and suitable decal artwork is not included. The spectrum option is a mesh-level multicolour treatment, not a continuous UV gradient.
- Screenshot export and shareable design URLs still need implementation and verification. Camera controls, undo/redo, fullscreen, and validated JSON import/export have been implemented but still require browser-level acceptance testing.
- A JSON export is a local configuration file, not a server-side saved design.
- No build or browser automation result is documented here as passing unless it has actually been run against the current revision.

## Performance and deployment

The GLB is large, so loading time depends on connection speed and device capability. The app uses a loading state, a capped device pixel ratio, and a Vercel SPA rewrite in `vercel.json`. Model compression or texture optimization should only be applied after verifying the source asset and configuring matching decoders.

Deploy using the repository's linked Vercel project once the integration has access to the correct team scope. After deployment, verify the production build, model loading, initial framing, configurator interactions and direct route navigation.

## Usage rights

The model is supplied by the repository owner. Confirm the rights to use any third-party branded model or branding before public commercial deployment.
