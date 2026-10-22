import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useProgress } from "@react-three/drei";
import { Camera, Download, Link2, Maximize2, Redo2, RotateCcw, Undo2, Upload } from "lucide-react";
import { Scene } from "./Scene";
import { takeShot } from "./shot";
import { decodeShare, designToJson, encodeShare, parseDesign } from "./codec";
import {
  FINISHES,
  GROUPS,
  LABELS,
  SWATCHES,
  TREATMENTS,
  type Finish,
  type PartId,
  type PartStyle,
  type Treatment,
} from "./parts";
import { PRESETS } from "./presets";
import { useChamber, type CameraPreset } from "./store";

const CHAPTERS = [
  {
    kicker: "01",
    title: "Hold",
    body: "Not a product page. One shoe, held in a dark room.",
  },
  {
    kicker: "02",
    title: "Seam",
    body: "Midsole, outsole, stitch. The sole is a stack of decisions.",
  },
  {
    kicker: "03",
    title: "Mark",
    body: "The beam drops. Everything but the swoosh steps back.",
  },
  {
    kicker: "04",
    title: "Pigment",
    body: "Colour sits in the leather. It is not a filter laid over a photo.",
  },
  {
    kicker: "05",
    title: "Bench",
    body: "Draw the knife. The last — the form inside the shoe — is still in there.",
  },
];

const CAMERAS: { id: CameraPreset; label: string }[] = [
  { id: "three", label: "3/4" },
  { id: "side", label: "Side" },
  { id: "front", label: "Toe" },
  { id: "heel", label: "Heel" },
  { id: "sole", label: "Sole" },
  { id: "top", label: "Top" },
];

function chapterIndex(progress: number) {
  const breaks = [0, 0.2, 0.42, 0.64, 0.82];
  let index = 0;
  for (let i = 0; i < breaks.length; i += 1) if (progress >= breaks[i]) index = i;
  return index;
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
            The chamber could not open. {this.state.message}
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
  const [chapter, setChapter] = useState(0);
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
  const { progress, active } = useProgress();
  const opening = mounted && webgl && (active || progress < 100);

  useEffect(() => {
    setMounted(true);
    setWebgl(hasWebGL());
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 760px)");
    useChamber.getState().setReduced(motion.matches);
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
    return () => {
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
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const store = useChamber.getState();
      if (event.key === "b") store.setMode("bench", progressRef.current);
      if (event.key === "p") store.setMode("pass");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      }
      if (store.mode === "bench" && event.key >= "1" && event.key <= "6") {
        store.setCamera(CAMERAS[Number(event.key) - 1].id);
      }
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
    const index = chapterIndex(next);
    setChapter((current) => (current === index ? current : index));
  }

  function goToChapter(index: number) {
    const el = scroller.current;
    if (!el) return;
    useChamber.getState().setMode("pass");
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTo({
      top: (index / (CHAPTERS.length - 1)) * max,
      behavior: reduced ? "auto" : "smooth",
    });
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
  const chapterCopy = CHAPTERS[chapter];

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
            <p className="max-w-sm font-mono text-sm text-steel">
              {mounted
                ? "This browser cannot open the chamber. WebGL is required."
                : "Opening the chamber."}
            </p>
          </div>
        )}
        <div className="vignette" />

        <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 py-4 md:px-8 md:py-6">
          <div>
            <p className="font-display text-2xl leading-none tracking-tight text-bone md:text-3xl">CHAMBER</p>
            <p className="mt-1 font-mono text-xs tracking-widest text-steel uppercase">A last, held in light</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={mode === "pass" ? "mode-btn mode-btn-on" : "mode-btn"}
              onClick={() => useChamber.getState().setMode("pass")}
              aria-pressed={mode === "pass"}
            >
              Pass
            </button>
            <button
              type="button"
              className={mode === "bench" ? "mode-btn mode-btn-on" : "mode-btn"}
              onClick={() => useChamber.getState().setMode("bench", progressRef.current)}
              aria-pressed={mode === "bench"}
            >
              Bench
            </button>
          </div>
        </header>

        {mode === "pass" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-end px-4 pb-8 md:items-center md:px-8 md:pb-0">
            <div className="pointer-events-auto w-full max-w-sm">
              <div className="mb-5 flex gap-2">
                {CHAPTERS.map((item, index) => (
                  <button
                    key={item.kicker}
                    type="button"
                    className={index === chapter ? "tick tick-on" : "tick"}
                    onClick={() => goToChapter(index)}
                    aria-label={`Chapter ${item.title}`}
                    aria-current={index === chapter ? "step" : undefined}
                  />
                ))}
              </div>
              <p className="font-mono text-xs tracking-widest text-heat uppercase">{chapterCopy.kicker}</p>
              <h1 className="font-display mt-1 text-5xl leading-none text-balance text-bone md:text-7xl">
                {chapterCopy.title}
              </h1>
              <p className="mt-4 max-w-xs text-pretty font-mono text-sm leading-relaxed text-bone/80">
                {chapterCopy.body}
              </p>
              {chapter === 0 && (
                <p className="mt-6 font-mono text-xs tracking-widest text-steel uppercase">Scroll the chamber</p>
              )}
              {chapter === CHAPTERS.length - 1 && (
                <button
                  type="button"
                  className="mode-btn mode-btn-on mt-6"
                  onClick={() => useChamber.getState().setMode("bench", progressRef.current)}
                >
                  Open the bench
                </button>
              )}
            </div>
          </div>
        )}

        <Knife
          value={knife}
          onChange={(value) => useChamber.getState().setKnife(value)}
        />

        {opening && (
          <p className="pointer-events-none absolute bottom-36 left-1/2 z-20 -translate-x-1/2 font-mono text-xs tracking-widest text-steel uppercase">
            Opening {Math.round(progress)}%
          </p>
        )}

        {mode === "bench" && (
          <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3 md:px-6 md:pb-5">
            <div className="dock">
              <div className="flex items-center gap-2 overflow-x-auto">
                {PRESETS.map((preset, index) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={design.name === preset.name ? "chip chip-on" : "chip"}
                    onClick={() => useChamber.getState().applyPreset(index)}
                  >
                    <span
                      className="swatch"
                      style={{ background: preset.parts.AF1_Quarter.color }}
                    />
                    <span
                      className="swatch swatch-edge"
                      style={{ background: preset.parts.AF1_Swoosh.color }}
                    />
                    {preset.name}
                  </button>
                ))}
                <button type="button" className="chip md:hidden" onClick={() => setSheet((open) => !open)}>
                  {sheet ? "Hide" : "Edit"}
                </button>
              </div>

              {sheet && style && (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex gap-2 overflow-x-auto">
                    {GROUPS.map((group) => {
                      const on = group.parts.every((id) => selected.includes(id)) && selected.length === group.parts.length;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          className={on ? "chip chip-on" : "chip"}
                          onClick={() => useChamber.getState().select(group.parts)}
                        >
                          {group.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-28 font-mono text-sm text-bone">
                      {partLabel}
                      {isolated ? " · isolated" : ""}
                    </p>
                    {SWATCHES.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        className="swatch-btn"
                        style={{ background: swatch }}
                        aria-label={`Colour ${swatch}`}
                        onClick={() => edit({ color: swatch })}
                      />
                    ))}
                    <label className="font-mono text-xs tracking-widest text-steel uppercase">
                      Colour
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
                  <p className="font-mono text-xs text-steel">
                    Click a panel. Double-click to isolate it. Draw the knife to open the last.
                  </p>
                </div>
              )}
              {notice && (
                <p className="mt-2 font-mono text-xs text-heat" role="status">
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
        aria-label="Draw the light knife"
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
