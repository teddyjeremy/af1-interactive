import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useProgress } from "@react-three/drei";
import { Camera, ChevronDown, Download, Link2, Maximize2, Redo2, RotateCcw, Undo2, Upload } from "lucide-react";
import { Cart } from "./Cart";
import { Scene } from "./Scene";
import { takeShot } from "./shot";
import { decodeShare, designToJson, encodeShare, parseDesign } from "./codec";
import {
  FINISHES,
  GROUPS,
  LABELS,
  PARTS,
  SWATCHES,
  TREATMENTS,
  type Finish,
  type PartStyle,
  type Treatment,
} from "./parts";
import { money, pairPrice, partPrice, selectionPrice, sizeAdd, SIZES } from "./pricing";
import { PRESETS } from "./presets";
import { useChamber, writeStudy, type CameraPreset } from "./store";

const CAMERAS: { id: CameraPreset; label: string }[] = [
  { id: "three", label: "3/4" },
  { id: "side", label: "Side" },
  { id: "front", label: "Toe" },
  { id: "heel", label: "Heel" },
  { id: "sole", label: "Sole" },
  { id: "top", label: "Top" },
];

function drift(value: number) {
  if (value === 0) return "";
  const body = money(Math.abs(value));
  return value > 0 ? `+${body}` : `−${body}`;
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function download(filename: string, href: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
}

class StageBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : "The stage failed to start." };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
          <p className="max-w-sm font-mono text-sm text-bone">
            The view did not start. {this.state.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Chamber() {
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState(true);
  const mode = useChamber((s) => s.mode);
  const design = useChamber((s) => s.design);
  const selected = useChamber((s) => s.selected);
  const isolated = useChamber((s) => s.isolated);
  const prints = useChamber((s) => s.prints);
  const knife = useChamber((s) => s.knife);
  const camera = useChamber((s) => s.camera);
  const past = useChamber((s) => s.past.length);
  const future = useChamber((s) => s.future.length);
  const notice = useChamber((s) => s.notice);
  const reduced = useChamber((s) => s.reduced);
  const size = useChamber((s) => s.size);
  const cartCount = useChamber((s) => s.cart.reduce((sum, line) => sum + line.qty, 0));
  const cartOpen = useChamber((s) => s.cartOpen);
  const { progress, active } = useProgress();
  const opening = mounted && webgl && (active || progress < 100);

  useEffect(() => {
    setMounted(true);
    setWebgl(hasWebGL());
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 760px)");
    useChamber.getState().setReduced(motion.matches);
    useChamber.getState().hydrateCart();
    useChamber.getState().hydrateStudy();
    setSheet(!narrow.matches);
    const onMotion = () => useChamber.getState().setReduced(motion.matches);
    const onHide = () => setHidden(document.hidden);
    motion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onHide);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("d");
    if (hash) {
      try {
        useChamber.getState().replaceDesign(decodeShare(hash), true);
        useChamber.getState().setMode("bench");
      } catch {
        useChamber.getState().setNotice("That shared design could not be read.");
      }
    }
    const unsub = useChamber.subscribe((state, prev) => {
      if (
        state.design !== prev.design ||
        state.prints !== prev.prints ||
        state.size !== prev.size ||
        state.edited !== prev.edited
      ) {
        writeStudy(state);
      }
    });
    return () => {
      unsub();
      motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => useChamber.getState().setNotice(null), 2800);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const store = useChamber.getState();
      const onSlider = target?.getAttribute("role") === "slider";
      if (event.key === "b") store.setMode("bench", progressRef.current);
      if (event.key === "p") {
        store.setMode("pass");
        scroller.current?.scrollTo({ top: 0, behavior: store.reduced ? "auto" : "smooth" });
      }
      if (event.key === "m" && store.mode === "bench") setSheet((open) => !open);
      if (event.key === "c") {
        const next = !store.cartOpen;
        store.setCartOpen(next);
        if (next) setSheet(false);
      }
      if (event.key === "Escape") {
        if (store.cartOpen) store.setCartOpen(false);
        else setSheet(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      }
      if (store.mode === "bench" && !onSlider && event.key >= "1" && event.key <= "6") {
        store.setCamera(CAMERAS[Number(event.key) - 1].id);
      }
      if (onSlider && (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Home" || event.key === "End")) {
        return;
      }
      if (event.key === " " && tag === "BUTTON") return;
      const paging =
        event.key === "PageDown" ||
        event.key === "PageUp" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === " ";
      const nudging = store.mode === "pass" && (event.key === "ArrowDown" || event.key === "ArrowUp");
      if (!paging && !nudging) return;
      event.preventDefault();
      const key = event.key;
      const fromBench = store.mode !== "pass";
      if (fromBench) store.setMode("pass");
      const apply = (resume: boolean) => {
        const node = scroller.current;
        if (!node) return;
        const page = Math.max(160, Math.round(node.clientHeight * 0.82));
        const step = Math.max(72, Math.round(node.clientHeight * 0.28));
        const max = Math.max(0, node.scrollHeight - node.clientHeight);
        let top = resume ? progressRef.current * max : node.scrollTop;
        if (key === "Home") top = 0;
        else if (key === "End") top = max;
        else if (key === "PageUp") top -= page;
        else if (key === "ArrowUp") top -= step;
        else if (key === "ArrowDown") top += step;
        else if (key === "PageDown" || key === " ") top += page;
        node.scrollTop = Math.min(max, Math.max(0, top));
      };
      if (!fromBench) {
        apply(false);
        return;
      }
      let frames = 0;
      const waitForPass = () => {
        frames += 1;
        const node = scroller.current;
        if (node && node.scrollHeight > node.clientHeight + 8) {
          apply(true);
          return;
        }
        if (frames < 40) requestAnimationFrame(waitForPass);
      };
      requestAnimationFrame(waitForPass);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const next = max > 0 ? el.scrollTop / max : 0;
    progressRef.current = next;
    if (bar.current) bar.current.style.transform = `scaleX(${next})`;
    const done = next > 0.94;
    setReady((current) => (current === done ? current : done));
  }

  function leaveBench() {
    useChamber.getState().setMode("pass");
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }

  function openBench() {
    useChamber.getState().setMode("bench", progressRef.current);
  }

  function edit(patch: Partial<PartStyle>) {
    const store = useChamber.getState();
    store.beginEdit();
    store.previewStyle(patch);
    store.endEdit();
  }

  function exportJson() {
    const current = useChamber.getState().design;
    const blob = new Blob([designToJson(current)], { type: "application/json" });
    download(`${current.name.toLowerCase().replaceAll(" ", "-")}.chamber.json`, URL.createObjectURL(blob));
  }

  function exportPng() {
    const href = takeShot();
    if (!href) {
      useChamber.getState().setNotice("The frame is not ready yet.");
      return;
    }
    download("chamber-study.png", href);
  }

  async function share() {
    const current = useChamber.getState().design;
    const url = new URL(window.location.href);
    url.hash = `d=${encodeShare(current)}`;
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url.toString());
      useChamber.getState().setNotice("Link copied.");
    } catch {
      useChamber.getState().setNotice("Link is in the address bar.");
    }
  }

  function onImport(file: File | undefined) {
    if (!file) return;
    void file.text().then((text) => {
      try {
        useChamber.getState().replaceDesign(parseDesign(JSON.parse(text)));
        useChamber.getState().setMode("bench", progressRef.current);
        useChamber.getState().setNotice(`Imported ${file.name}.`);
      } catch {
        useChamber.getState().setNotice("That file is not a chamber design.");
      }
    });
  }

  function toggleSheet() {
    setSheet((open) => {
      const next = !open;
      if (next) useChamber.getState().setCartOpen(false);
      return next;
    });
  }

  function openCart() {
    const store = useChamber.getState();
    const next = !store.cartOpen;
    store.setCartOpen(next);
    if (next) setSheet(false);
  }

  function addPair() {
    setSheet(false);
    useChamber.getState().addToCart();
  }

  async function fullscreen() {
    const node = scroller.current;
    if (!node) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await node.requestFullscreen();
  }

  const focus = selected[0];
  const style = focus ? design.parts[focus] : null;
  const partLabel =
    selected.length === 1 && focus
      ? LABELS[focus]
      : selected.length > 1
        ? `${selected.length} panels`
        : "Panel";
  const selPrice = selectionPrice(design, selected);
  const total = pairPrice(design, prints, size);
  const base = pairPrice(PRESETS[0], false, 9);
  const delta = total - base;

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className={`relative h-dvh bg-ink text-bone ${mode === "bench" ? "overflow-hidden" : "overflow-y-auto"}`}
    >
      <div className="sticky top-0 h-dvh">
        <div ref={bar} className="progress-bar" />
        {mounted && webgl ? (
          <StageBoundary>
            <div className="absolute inset-0">
              <Scene progressRef={progressRef} hidden={hidden} />
            </div>
          </StageBoundary>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
            <p className="max-w-sm text-sm text-steel">
              {mounted ? "WebGL is required." : "Opening"}
            </p>
          </div>
        )}
        <div className="vignette" />

        <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-5 py-4 md:px-8">
          <div>
            <p className="wordmark text-bone">Chamber</p>
            {mode === "pass" && !ready && <p className="eyebrow">Scroll</p>}
          </div>
          <div className="flex gap-2">
            {mode === "bench" && (
              <button type="button" className="mode-btn" onClick={leaveBench}>
                Pass
              </button>
            )}
            <button
              type="button"
              className={cartOpen ? "mode-btn mode-btn-on" : "mode-btn"}
              onClick={openCart}
              aria-pressed={cartOpen}
            >
              Cart{cartCount ? ` ${cartCount}` : ""}
            </button>
          </div>
        </header>

        {mode === "pass" && ready && (
          <button type="button" className="mode-btn mode-btn-on end-action" onClick={openBench}>
            Bench
          </button>
        )}

        <Knife
          value={knife}
          onChange={(value) => useChamber.getState().setKnife(value)}
        />

        {opening && (
          <p className="pointer-events-none absolute top-20 left-5 z-20 text-xs text-steel md:left-8">
            Opening {Math.round(progress)}%
          </p>
        )}

        <Cart />

        {mode === "bench" && !sheet && style && (
          <div className="rail">
            <button type="button" className="chip chip-on" aria-expanded={false} onClick={toggleSheet}>
              Edit
            </button>
            <span className="swatch" style={{ background: style.color }} />
            <p className="min-w-0 text-sm text-bone">
              {partLabel}
              <span className="text-steel"> {money(total)}</span>
            </p>
          </div>
        )}

        {mode === "bench" && sheet && (
          <div className="absolute inset-x-0 bottom-0 z-20 px-3 pr-16 pb-3 md:px-8 md:pr-20 md:pb-5">
            <div className="instrument">
              <div className="dock-head">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-bone">{design.name}</p>
                  <p className="truncate text-xs text-steel">
                    {partLabel}
                    {isolated ? " isolated" : ""}
                  </p>
                </div>
                <p className="text-sm text-bone">{money(total)}</p>
                <button type="button" className="chip" aria-expanded onClick={toggleSheet}>
                  <ChevronDown />
                  Hide
                </button>
                <button type="button" className="chip chip-on" onClick={addPair}>
                  Add
                </button>
              </div>

              {style && (
                <div className="inst-scroll">
                  <div className="inst-group">
                    <p className="inst-label">Material</p>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {PRESETS.map((preset, index) => (
                      <button
                        key={preset.name}
                        type="button"
                        className={design.name === preset.name ? "chip chip-on" : "chip"}
                        onClick={() => useChamber.getState().applyPreset(index)}
                      >
                        <span className="swatch" style={{ background: preset.parts.AF1_Quarter.color }} />
                        <span className="swatch swatch-edge" style={{ background: preset.parts.AF1_Swoosh.color }} />
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {GROUPS.map((group) => {
                      const on =
                        group.parts.every((id) => selected.includes(id)) && selected.length === group.parts.length;
                      const groupPrice = selectionPrice(design, group.parts);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          className={on ? "chip chip-on" : "chip"}
                          onClick={() => useChamber.getState().select(group.parts)}
                        >
                          {group.label}
                          <span className="text-steel">{money(groupPrice)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {PARTS.map((id) => {
                      const on = selected.length === 1 && selected[0] === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={on ? "chip chip-on" : "chip"}
                          onClick={() => useChamber.getState().select([id])}
                        >
                          {LABELS[id]}
                          <span className="text-steel">{money(partPrice(design.parts[id], id))}</span>
                        </button>
                      );
                    })}
                  </div>
                  </div>
                  <div className="inst-group">
                    <p className="inst-label">Colour</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-28 text-sm text-bone">
                      {partLabel}
                      <span className="text-steel"> {money(selPrice)}</span>
                    </p>
                    {SWATCHES.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        className={style.color.toLowerCase() === swatch ? "swatch-btn swatch-on" : "swatch-btn"}
                        style={{ background: swatch }}
                        aria-label={`Colour ${swatch}`}
                        onClick={() => edit({ color: swatch })}
                      />
                    ))}
                    <label className="text-xs tracking-widest text-steel uppercase">
                      Mix
                      <input
                        className="ml-2 h-11 w-14 cursor-pointer bg-transparent"
                        type="color"
                        value={style.color}
                        aria-label={`Colour for ${partLabel}`}
                        onPointerDown={() => useChamber.getState().beginEdit()}
                        onChange={(event) => useChamber.getState().previewStyle({ color: event.target.value })}
                        onBlur={() => useChamber.getState().endEdit()}
                      />
                    </label>
                  </div>
                  </div>
                  <div className="inst-group">
                    <p className="inst-label">Surface</p>
                    <div className="flex flex-wrap gap-2">
                      {FINISHES.map((finish) => (
                        <button
                          key={finish}
                          type="button"
                          className={style.finish === finish ? "chip chip-on" : "chip"}
                          onClick={() => edit({ finish: finish as Finish })}
                        >
                          {finish}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="inst-group">
                    <p className="inst-label">Treatment</p>
                    <div className="flex flex-wrap gap-2">
                      {TREATMENTS.map((treatment) => (
                        <button
                          key={treatment}
                          type="button"
                          className={style.treatment === treatment ? "chip chip-on" : "chip"}
                          onClick={() => edit({ treatment: treatment as Treatment })}
                        >
                          {treatment}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={prints ? "chip chip-on" : "chip"}
                        onClick={() => useChamber.getState().setPrints(!prints)}
                        aria-pressed={prints}
                      >
                        Prints
                      </button>
                      {isolated && (
                        <button type="button" className="chip" onClick={() => useChamber.getState().isolate(null)}>
                          Release
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="inst-group">
                    <p className="inst-label">Size</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {SIZES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={size === item ? "chip chip-on" : "chip"}
                        onClick={() => useChamber.getState().setSize(item)}
                        aria-pressed={size === item}
                      >
                        {item}
                        {sizeAdd(item) > 0 ? ` +${sizeAdd(item)}` : ""}
                      </button>
                    ))}
                  </div>
                  </div>
                  <div className="inst-group">
                    <p className="inst-label">View</p>
                  <div className="flex flex-wrap gap-2">
                    {CAMERAS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={camera === item.id ? "chip chip-on" : "chip"}
                        onClick={() => useChamber.getState().setCamera(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                    <IconButton label="Reset view" onClick={() => useChamber.getState().nudgeCamera()}>
                      <RotateCcw />
                    </IconButton>
                    <IconButton label="Undo" disabled={past === 0} onClick={() => useChamber.getState().undo()}>
                      <Undo2 />
                    </IconButton>
                    <IconButton label="Redo" disabled={future === 0} onClick={() => useChamber.getState().redo()}>
                      <Redo2 />
                    </IconButton>
                    <IconButton label="Reset design" onClick={() => useChamber.getState().reset()}>
                      <RotateCcw />
                    </IconButton>
                    <IconButton label="Export design" onClick={exportJson}>
                      <Download />
                    </IconButton>
                    <IconButton label="Import design" onClick={() => fileRef.current?.click()}>
                      <Upload />
                    </IconButton>
                    <IconButton label="Save image" onClick={exportPng}>
                      <Camera />
                    </IconButton>
                    <IconButton label="Copy link" onClick={() => void share()}>
                      <Link2 />
                    </IconButton>
                    <IconButton label="Fullscreen" onClick={() => void fullscreen()}>
                      <Maximize2 />
                    </IconButton>
                  </div>
                  </div>
                  <div className="inst-group">
                    <div className="price-row">
                      <p className="inst-label">Price</p>
                      <p className="text-sm text-bone">
                        {money(total)}
                        {delta !== 0 ? ` ${drift(delta)}` : ""}
                      </p>
                    </div>
                    <p className="text-xs text-steel">
                      {partLabel} {money(selPrice)}. US {size}.
                    </p>
                  </div>
                </div>
              )}
              {notice && (
                <p className="dock-note font-mono text-xs text-heat" role="status">
                  {notice}
                </p>
              )}
            </div>
          </div>
        )}

        {mode === "pass" && notice && (
          <p className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 font-mono text-xs text-heat" role="status">
            {notice}
          </p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            onImport(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {mode === "pass" && <div className="h-[380vh]" aria-hidden="true" />}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function Knife({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const track = useRef<HTMLDivElement>(null);

  function setFromClientY(clientY: number) {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    onChange((clientY - rect.top) / rect.height);
  }

  return (
    <div className="absolute top-1/2 right-3 z-20 flex -translate-y-1/2 flex-col items-center gap-3 md:right-6">
      <p className="knife-label">Knife</p>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Knife"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className="knife"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromClientY(event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) setFromClientY(event.clientY);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") onChange(value + 0.05);
          if (event.key === "ArrowUp") onChange(value - 0.05);
          if (event.key === "Home") onChange(0);
          if (event.key === "End") onChange(1);
        }}
      >
        <span className="knife-notch" style={{ top: `${value * 100}%` }} />
      </div>
    </div>
  );
}
