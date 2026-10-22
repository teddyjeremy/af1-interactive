import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Download, Eye, Layers3, Menu, MousePointer2, Maximize2, Minimize2, Redo2, RotateCcw, Sparkles, Undo2, Upload, WandSparkles, X } from 'lucide-react'
import Experience, { designs, type PartInfo } from './Experience'

type View = 'home' | 'customize'
type DesignSnapshot = { designIndex: number; customColors: Record<string, string>; effect: string; finish: string }
const swatches = ['#f6f2e9','#171717','#ff3b91','#ff5d35','#ffd400','#c8ff00','#00d9ff','#4b4bff','#9c63ff','#7dffb3','#8a573b','#a7a7a7']
const effects: { id: string; label: string; desc: string; disabled?: boolean }[] = [
  {id:'none',label:'Clean finish',desc:'Colour only'},
  {id:'rainbow',label:'Spectrum panels',desc:'Multi-colour mesh palette'},
  {id:'drip',label:'Liquid drip',desc:'Unavailable · UV mask needed',disabled:true},
  {id:'splatter',label:'Paint splatter',desc:'Unavailable · UV mask needed',disabled:true},
]
const defaults = ['#f5f0e6','#191919','#ff3d91','#ffd400','#00d9ff','#7b4dff']

export default function App() {
  const [view, setView] = useState<View>('home')
  const [designIndex, setDesignIndex] = useState(0)
  const [parts, setParts] = useState<PartInfo[]>([])
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [customColors, setCustomColors] = useState<Record<string,string>>({})
  const [activeColor, setActiveColor] = useState('#ff3d91')
  const [effect, setEffect] = useState('none')
  const [finish, setFinish] = useState('satin')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [undoStack, setUndoStack] = useState<DesignSnapshot[]>([])
  const [redoStack, setRedoStack] = useState<DesignSnapshot[]>([])
  const [studioNotice, setStudioNotice] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  const studioViewportRef = useRef<HTMLDivElement>(null)
  const [cameraPreset, setCameraPreset] = useState('three-quarter')
  const [cameraResetToken, setCameraResetToken] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const progress = useRef(0)
  const [scrollPercent, setScrollPercent] = useState(0)
  const storyRef = useRef<HTMLDivElement>(null)

  const updateProgress = useCallback(() => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const value = window.scrollY / max
    progress.current = value
    setScrollPercent(value)
  }, [])
  useEffect(() => {
    updateProgress()
    window.addEventListener('scroll', updateProgress, {passive:true})
    window.addEventListener('resize', updateProgress)
    return () => { window.removeEventListener('scroll', updateProgress); window.removeEventListener('resize', updateProgress) }
  }, [updateProgress, view])

  useEffect(() => {
    if (view === 'customize') window.scrollTo({top:0,behavior:'smooth'})
  }, [view])

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await studioViewportRef.current?.requestFullscreen()
    } catch {
      setStudioNotice('Fullscreen is unavailable in this browser.')
    }
  }

  const recordHistory = () => {
    setUndoStack(previous => [...previous, { designIndex, customColors: { ...customColors }, effect, finish }].slice(-30))
    setRedoStack([])
  }
  const undo = () => {
    if (!undoStack.length) return
    const previous = undoStack[undoStack.length - 1]
    setRedoStack(stack => [...stack, { designIndex, customColors: { ...customColors }, effect, finish }].slice(-30))
    setUndoStack(stack => stack.slice(0, -1))
    setDesignIndex(previous.designIndex); setCustomColors(previous.customColors); setEffect(previous.effect); setFinish(previous.finish)
    setStudioNotice('Previous design state restored.')
  }
  const redo = () => {
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack(stack => [...stack, { designIndex, customColors: { ...customColors }, effect, finish }].slice(-30))
    setRedoStack(stack => stack.slice(0, -1))
    setDesignIndex(next.designIndex); setCustomColors(next.customColors); setEffect(next.effect); setFinish(next.finish)
    setStudioNotice('Design change restored.')
  }
  const openCustomizer = (index = designIndex) => {
    setDesignIndex(index)
    setView('customize')
    setMenuOpen(false)
  }
  const changeDesign = (index:number) => {
    recordHistory()
    setStudioNotice('')
    setDesignIndex((index + designs.length) % designs.length)
    setCustomColors({})
    setEffect('none')
    setFinish('satin')
  }
  const applyColor = (color:string) => {
    recordHistory()
    setStudioNotice('')
    setActiveColor(color)
    if (!selectedPart) {
      setSelectedPart(parts[0]?.name ?? null)
      if (parts[0]) setCustomColors(prev => ({...prev,[parts[0].name]:color}))
      return
    }
    setCustomColors(prev => ({...prev,[selectedPart]:color}))
  }
  const reset = () => { recordHistory(); setCustomColors({}); setEffect('none'); setFinish('satin'); setSelectedPart(null); setDesignIndex(0); setStudioNotice('Studio reset to the default preset.') }
  const exportDesign = () => {
    const payload = { version: 1, designIndex, presetName: designs[designIndex].name, effect, finish, partColors: customColors, createdAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'af1-custom-design.json'; a.click(); URL.revokeObjectURL(url)
    setStudioNotice('Design configuration exported as JSON.')
  }
  const importDesign = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object') throw new Error('The file must contain a JSON object.')
      const data = parsed as Record<string, unknown>
      if (data.version !== 1) throw new Error('Unsupported or missing design version. Import a version 1 AF1 design file.')
      if (!Number.isInteger(data.designIndex) || (data.designIndex as number) < 0 || (data.designIndex as number) >= designs.length) throw new Error('The preset index is invalid.')
      if (typeof data.effect !== 'string' || !effects.some(item => item.id === data.effect && !item.disabled)) throw new Error('The selected effect is not supported.')
      const allowedFinishes = ['matte', 'satin', 'gloss', 'high-gloss', 'metallic']
      if (data.finish !== undefined && (typeof data.finish !== 'string' || !allowedFinishes.includes(data.finish))) throw new Error('The selected material finish is not supported.')
      if (!data.partColors || typeof data.partColors !== 'object' || Array.isArray(data.partColors)) throw new Error('Part colours must be an object.')
      const colors = data.partColors as Record<string, unknown>
      const validated: Record<string, string> = {}
      for (const [name, value] of Object.entries(colors)) {
        if (!name || typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error('A part colour is invalid. Use six-digit HEX colours.')
        validated[name] = value
      }
      recordHistory()
      setDesignIndex(data.designIndex as number)
      setEffect(data.effect)
      setFinish(typeof data.finish === 'string' ? data.finish : 'satin')
      setCustomColors(validated)
      setStudioNotice('Design imported successfully.')
    } catch (error) {
      setStudioNotice(error instanceof Error ? error.message : 'Could not import this design file.')
    }
  }
  const visibleParts = useMemo(() => parts.filter(p => p.name && p.name !== 'Unnamed part'), [parts])

  return <main className={view === 'customize' ? 'app app-customizer' : 'app'}>
    <header className="topbar">
      <button className="brand" onClick={() => {setView('home');window.scrollTo({top:0,behavior:'smooth'})}} aria-label="AF1 Playground home">
        <span className="brand-mark">A<span>F</span>1</span><span className="brand-divider" /><span className="brand-sub">PLAYGROUND<br/>VOL. 001</span>
      </button>
      <nav className={menuOpen ? 'nav nav-open' : 'nav'}>
        <a href="#experience" onClick={() => setView('home')}>EXPERIENCE</a>
        <a href="#colour-lab" onClick={() => setView('home')}>COLOUR LAB</a>
        <button className="nav-cta" onClick={() => openCustomizer()}>OPEN CUSTOMIZER <ArrowRight size={15}/></button>
      </nav>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X/> : <Menu/>}</button>
    </header>

    {view === 'home' ? <>
      <div className="scene-fixed" aria-label="Interactive 3D sneaker scene">
        <div className="scene-glow" style={{background: designs[designIndex].background}} />
        <div className="scene-caption scene-caption-left"><span>OBJECT 001</span><b>THE ICON, REWIRED.</b></div>
        <div className="scene-caption scene-caption-right"><span>SCROLL TO MUTATE</span><ArrowDownRight size={18}/></div>
        <div className="scene-canvas"><Experience progress={progress} designIndex={designIndex} customColors={customColors} selectedPart={selectedPart} finish={finish} effect={effect} cameraPreset={cameraPreset} cameraResetToken={cameraResetToken} onParts={setParts} onSelectPart={setSelectedPart} onReady={setModelReady}/></div>
        <div className="scene-crosshair">+</div>
        <div className="scene-index"><span>AF1 / {String(designIndex+1).padStart(2,'0')}</span><span>{modelReady ? 'MODEL ONLINE' : 'LOADING MODEL'}</span></div>
      </div>
      <div className="story" ref={storyRef}>
        <section id="experience" className="story-section hero-section">
          <div className="eyebrow"><span className="status-dot"/> A DIGITAL SNEAKER EXPERIMENT <span>— 001 / 006</span></div>
          <h1>MAKE<br/><em>YOUR</em> <span>MARK.</span></h1>
          <p className="hero-copy">One silhouette. Infinite energy. Scroll through colour, chaos and custom culture.</p>
          <div className="hero-actions"><button className="button button-light" onClick={() => openCustomizer()}>BUILD YOUR AF1 <ArrowRight size={16}/></button><span className="micro-note">SCROLL TO START <ArrowDownRight size={15}/></span></div>
          <div className="hero-side-note">DESIGNED TO<br/>BREAK THE GRID</div>
          <div className="scroll-cue"><span className="scroll-line"/> KEEP MOVING</div>
        </section>
        <section className="story-section manifesto-section">
          <div className="section-number">01 <span>/ THE SHIFT</span></div>
          <div className="manifesto-copy"><p>NOT JUST A SHOE.</p><h2>A MOVING<br/><span>CANVAS.</span></h2><p className="muted">Scroll changes the angle. Colour changes the mood. Your cursor becomes part of the composition.</p></div>
          <div className="orbit-label orbit-one">FORM / 01</div><div className="orbit-label orbit-two">MOTION / 02</div>
        </section>
        <section id="colour-lab" className="story-section palette-section">
          <div className="section-number">02 <span>/ THE COLOUR LAB</span></div>
          <div className="palette-heading"><div><p className="eyebrow">CHOOSE YOUR FREQUENCY</p><h2>COLOUR<br/><em>IS A</em> SIGNAL.</h2></div><p>Six colour stories. One familiar form. Pick a world and the sneaker transforms with it.</p></div>
          <div className="design-grid">{designs.map((d,i)=><button className={designIndex===i?'design-card design-card-active':'design-card'} key={d.name} onClick={()=>changeDesign(i)} style={{'--card-color':d.background,'--card-accent':d.accent} as React.CSSProperties}><span className="design-card-no">0{i+1}</span><span className="design-card-orb"/><span className="design-card-info"><b>{d.name}</b><small>{d.note}</small></span><span className="design-card-arrow"><ArrowRight size={17}/></span></button>)}</div>
          <button className="button button-acid" onClick={() => openCustomizer(designIndex)}>CUSTOMIZE THIS COLOURWAY <ArrowRight size={16}/></button>
        </section>
        <section className="story-section break-section">
          <div className="section-number">03 <span>/ MAKE IT YOURS</span></div>
          <p className="eyebrow">YOUR RULES. YOUR PALETTE.</p><h2>THE ONLY<br/>LIMIT IS <em>DEFAULT.</em></h2>
          <p className="break-copy">Select a panel. Throw on a colour. Add a little chaos. The studio is yours.</p>
          <button className="button button-light" onClick={() => openCustomizer(designIndex)}>ENTER THE STUDIO <WandSparkles size={16}/></button>
          <div className="giant-sticker">AF<span>1</span></div>
        </section>
        <footer className="footer"><div className="brand-mark">A<span>F</span>1</div><p>AN EXPERIMENT IN FORM, COLOUR & MOTION.</p><span>© PLAYGROUND / 2026</span></footer>
      </div>
    </> : <div className="customizer">
      <div className="customizer-heading"><button className="back-link" onClick={() => setView('home')}><ArrowLeft size={16}/> BACK TO EXPERIENCE</button><div><span className="eyebrow">AF1 / DESIGN STUDIO</span><h1>MAKE IT <em>YOURS.</em></h1><p>Pick a part. Pick a colour. Make something loud.</p></div><span className="studio-tag"><span className="status-dot"/> LIVE 3D STUDIO</span></div>
      <div className="studio-layout">
        <div className="studio-viewport" ref={studioViewportRef}>
          <div className="studio-viewport-top"><span>PREVIEW / {designs[designIndex].name}</span><span>DRAG TO ORBIT <MousePointer2 size={13}/></span></div>
          <div className="camera-controls" aria-label="Camera views">{[{id:'side',label:'SIDE'},{id:'three-quarter',label:'3/4'},{id:'front',label:'FRONT'},{id:'rear',label:'REAR'},{id:'top',label:'TOP'}].map(preset=><button key={preset.id} className={cameraPreset===preset.id?'camera-preset camera-preset-active':'camera-preset'} onClick={()=>{setCameraPreset(preset.id);setCameraResetToken(token=>token+1)}}>{preset.label}</button>)}<button className="camera-preset camera-fullscreen" onClick={()=>void toggleFullscreen()} aria-label={isFullscreen?'Exit fullscreen':'Enter fullscreen'}>{isFullscreen?<Minimize2 size={13}/>:<Maximize2 size={13}/>}</button></div>
          <div className="studio-model"><Experience progress={progress} designIndex={designIndex} customColors={customColors} selectedPart={selectedPart} finish={finish} effect={effect} cameraPreset={cameraPreset} cameraResetToken={cameraResetToken} onParts={setParts} onSelectPart={setSelectedPart} onReady={setModelReady} interactive/></div>
          <div className="studio-viewport-bottom"><span>{selectedPart ? selectedPart : 'SELECT A PART IN THE LIST'}</span><span>{visibleParts.length} MESHES DETECTED</span></div>
        </div>
        <aside className="editor-panel">
          <div className="editor-block"><div className="editor-label"><span>01 / COLOUR STORY</span><span>{String(designIndex+1).padStart(2,'0')} OF 06</span></div><div className="current-design"><div className="current-design-swatch" style={{background:designs[designIndex].background}}/><div><b>{designs[designIndex].name}</b><small>{designs[designIndex].note}</small></div><div className="design-arrows"><button onClick={()=>changeDesign(designIndex-1)} aria-label="Previous design"><ArrowLeft size={15}/></button><button onClick={()=>changeDesign(designIndex+1)} aria-label="Next design"><ArrowRight size={15}/></button></div></div></div>
          <div className="editor-block"><div className="editor-label"><span>02 / TARGET PART</span><span>{visibleParts.length} FOUND</span></div><div className="parts-list">{visibleParts.length ? visibleParts.map((part,i)=><button key={part.name} className={selectedPart===part.name?'part-row part-row-active':'part-row'} onClick={()=>setSelectedPart(part.name)}><span className="part-number">{String(i+1).padStart(2,'0')}</span><span className="part-name">{part.name.replace(/^AF1[_-]?/,'').replaceAll('_',' ')}</span><span className="part-material">{part.materialNames[0] || 'DEFAULT MAT'}</span><span className="part-check">{selectedPart===part.name && <Check size={14}/>}</span></button>) : <p className="parts-loading">Loading mesh names from your GLB…</p>}</div><p className="helper-note">Mesh and material names are read directly from your exported model.</p></div>
          <div className="editor-block"><div className="editor-label"><span>03 / COLOUR PICKER</span><span>{activeColor.toUpperCase()}</span></div><div className="color-grid">{swatches.map(color=><button key={color} className={activeColor===color?'color-swatch color-swatch-active':'color-swatch'} style={{'--swatch':color} as React.CSSProperties} onClick={()=>applyColor(color)} aria-label={'Apply '+color}><span/></button>)}</div><div className="custom-color-row"><label htmlFor="customColor">CUSTOM HEX</label><input id="customColor" value={activeColor} onChange={e=>setActiveColor(e.target.value)} onBlur={()=>/^#[0-9a-fA-F]{6}$/.test(activeColor)&&applyColor(activeColor)} maxLength={7}/><button onClick={()=>/^#[0-9a-fA-F]{6}$/.test(activeColor)&&applyColor(activeColor)}>APPLY</button></div></div>
          <div className="editor-block"><div className="editor-label"><span>04 / MATERIAL FINISH</span><span>WHOLE SNEAKER</span></div><div className="effects-list">{[{id:'matte',label:'Matte',desc:'Soft / low reflectance'},{id:'satin',label:'Satin',desc:'Balanced sheen'},{id:'gloss',label:'Gloss',desc:'Clear reflections'},{id:'high-gloss',label:'High gloss',desc:'Sharp highlights'},{id:'metallic',label:'Metallic',desc:'Metal-like response'}].map(item=><button key={item.id} className={finish===item.id?'effect-option effect-option-active':'effect-option'} onClick={()=>{recordHistory();setFinish(item.id);setStudioNotice('')}}><span className="effect-icon">{item.id==='matte'?'◌':item.id==='satin'?'◍':item.id==='gloss'?'◉':item.id==='high-gloss'?'✦':'◇'}</span><span><b>{item.label}</b><small>{item.desc}</small></span><span className="effect-radio"/></button>)}</div><p className="helper-note">Finish controls update the sneaker's physically based roughness and metallic response.</p></div>
          <div className="editor-block"><div className="editor-label"><span>05 / SURFACE EFFECT</span><Sparkles size={14}/></div><div className="effects-list">{effects.map(item=><button key={item.id} className={effect===item.id?'effect-option effect-option-active':'effect-option'} disabled={item.disabled} onClick={()=>{if(item.disabled)return;recordHistory();setEffect(item.id);setStudioNotice('')}}><span className={'effect-icon effect-'+item.id}>{item.id==='none'?'○':item.id==='rainbow'?'◉':item.id==='drip'?'⌁':'✳'}</span><span><b>{item.label}</b><small>{item.desc}</small></span><span className="effect-radio"/></button>)}</div><p className="helper-note">{effect==='none'?'Keep the original texture detail and experiment with colour.':effect==='rainbow'?'Spectrum panels recolour the actual shoe meshes with a vivid multi-colour palette. This is a mesh-level treatment, not a UV gradient.':'Surface decals are unavailable until suitable UV masks or decal artwork are added.'}</p></div>
          <div className="editor-actions">
            <div className="history-actions"><button className="reset-button" disabled={!undoStack.length} onClick={undo}><Undo2 size={14}/> UNDO</button><button className="reset-button" disabled={!redoStack.length} onClick={redo}><Redo2 size={14}/> REDO</button></div>
            <button className="button button-acid" onClick={exportDesign}><Download size={15}/> EXPORT DESIGN SETTINGS</button>
            <button className="reset-button" onClick={() => importInput.current?.click()}><Upload size={14}/> IMPORT DESIGN JSON</button>
            <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void importDesign(file); event.currentTarget.value = '' }} />
            {studioNotice && <p className="studio-notice" role="status">{studioNotice}</p>}
            <button className="reset-button" onClick={reset}><RotateCcw size={14}/> RESET STUDIO</button>
          </div>
        </aside>
      </div>
      <p className="studio-disclaimer"><CircleHelp size={13}/> This exports your colour/effect configuration as JSON, not a new GLB. Texture-based drip and splatter overlays need their artwork/masks added for final rendering.</p>
    </div>}
  </main>
}
