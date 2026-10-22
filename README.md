# AF1 Playground — Interactive 3D Sneaker Experience

A scroll-driven React + Three.js sneaker experiment with a live configurator.

## Stack
- React + Vite + TypeScript
- Three.js via React Three Fiber
- Drei (GLTF loading, environment lighting, float, contact shadows, orbit controls)
- Responsive CSS, Lucide icons
- Vercel-ready SPA configuration

## Model
The app loads the existing model at `/models/nike%20shoes.glb`, which is stored in `models/nike shoes.glb` in this repository. The deployment setup should serve the same file from the public URL. If the build's public asset layout differs, copy the model into `public/models/nike shoes.glb` and update the loader path accordingly.

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Features
- Persistent 3D sneaker stage behind a scroll-led story
- Scroll progress changes shoe rotation, position and scale
- Six colourful design palettes
- Mesh discovery from the GLB at runtime
- Colour controls for named mesh parts
- Orbit interaction in the configurator
- JSON export of selected design settings
- Responsive mobile layout and reduced-motion-friendly CSS

## Important model notes
The GLB is approximately 42.9 MB. It may take a while to load on slower connections; the app shows a loading state. For production, optimize the model and use meshopt/Draco only if you export and configure the decoder appropriately.

The effect selector currently provides the UI foundation for rainbow, drip and splatter effects. Accurate drip/splatter visuals require overlay artwork or UV masks. The colour picker uses the mesh material colour multiplier, so dark or strongly coloured base textures can affect the resulting colour.

The model is supplied by the repository owner. Make sure you have rights to use any third-party branded model and branding in a public commercial deployment.
