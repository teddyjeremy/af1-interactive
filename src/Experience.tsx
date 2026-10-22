import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Float, Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export type PartInfo = { name: string; materialNames: string[]; color: string; meshCount: number }
export type Design = { name: string; colors: string[]; background: string; accent: string; note: string }

export const designs: Design[] = [
  { name: 'CHROME BLOOM', colors: ['#f7f4ed','#ff3d9a','#ffce00','#12d8fa','#202020'], background: '#ff4b9b', accent: '#c9ff45', note: 'Candy colour / high voltage' },
  { name: 'ACID GARDEN', colors: ['#d7ff00','#171717','#a4ff4f','#ff5c35','#f5f0e6'], background: '#b5e600', accent: '#ff4b9b', note: 'Neon green / ink black' },
  { name: 'BLUE HOUR', colors: ['#f6f5f0','#5a56ff','#00d9ff','#111a32','#d9ffef'], background: '#5b55ff', accent: '#c9ff45', note: 'Electric blue / icy cyan' },
  { name: 'SUNSET CLUB', colors: ['#ff5d35','#ffb13b','#ff3d9a','#5b244c','#fff0d6'], background: '#ff683d', accent: '#5b244c', note: 'Heatwave / sunset pink' },
  { name: 'DIGITAL CAMO', colors: ['#e8ffb7','#263b2a','#7ca04b','#e8b931','#171a17'], background: '#9fc66a', accent: '#ff5d35', note: 'Field tones / acid details' },
  { name: 'GRAPE SODA', colors: ['#d9c7ff','#6d3eff','#ff7dd5','#252044','#f5f0ff'], background: '#a17aff', accent: '#c9ff45', note: 'Violet haze / candy gloss' },
]

const palette = ['#f6f2e9','#171717','#ff3b91','#ff5d35','#ffd400','#c8ff00','#00d9ff','#4b4bff','#9c63ff','#7dffb3','#8a573b','#a7a7a7']

function normalizeName(name: string) {
  return name.replace(/^AF1[_\s-]*/i, '').replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
}
function getColor(material: THREE.Material) {
  const m = material as THREE.MeshStandardMaterial
  return m.color?.getHexString ? '#' + m.color.getHexString() : '#f5f0e6'
}

function Shoe({ progress, designIndex, customColors, selectedPart, onParts, onSelectPart, onReady, interactive = false }: {
  progress: React.MutableRefObject<number>; designIndex: number; customColors: Record<string,string>; selectedPart: string | null;
  onParts: (parts: PartInfo[]) => void; onSelectPart: (name: string) => void; onReady: (ready: boolean) => void; interactive?: boolean
}) {
  const { scene } = useGLTF('https://raw.githubusercontent.com/teddyjeremy/af1-interactive/main/models/nike%20shoes.glb')
  const group = useRef<THREE.Group>(null)
  const meshes = useRef<THREE.Mesh[]>([])
  const originalColors = useRef<Record<string,string>>({})
  const appliedDesign = designs[designIndex]

  const partData = useMemo(() => {
    const list: PartInfo[] = []
    const materialsSeen = new Set<string>()
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = true
      obj.receiveShadow = true
      meshes.current.push(obj)
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      const materialNames: string[] = []
      mats.forEach((mat, i) => {
        if (!originalColors.current[mat.uuid]) originalColors.current[mat.uuid] = getColor(mat)
        const key = mat.name || `Material ${i + 1}`
        materialNames.push(key)
        if (!materialsSeen.has(key)) materialsSeen.add(key)
      })
      list.push({ name: obj.name || 'Unnamed part', materialNames, color: getColor(mats[0]), meshCount: 1 })
    })
    const unique = Array.from(new Map(list.map(p => [p.name, p])).values()).sort((a,b) => a.name.localeCompare(b.name))
    onParts(unique)
    onReady(true)
    return unique
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  useEffect(() => {
    meshes.current = []
    return () => { onReady(false) }
  }, [scene, onReady])

  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      const designColor = appliedDesign.colors[Math.abs(obj.name.split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % appliedDesign.colors.length]
      const custom = customColors[obj.name]
      mats.forEach((material) => {
        const mat = material as THREE.MeshStandardMaterial
        if (!mat.color) return
        mat.color.set(custom || (selectedPart === obj.name ? (customColors[obj.name] || designColor) : designColor))
        mat.needsUpdate = true
      })
    })
  }, [scene, designIndex, customColors, selectedPart, appliedDesign.colors])

  useFrame((state, delta) => {
    if (!group.current) return
    const p = progress.current
    const targetY = p < 0.18 ? 0.05 : p < 0.42 ? -0.3 : p < 0.68 ? 0.05 : 0.35
    const targetRotY = state.pointer.x * 0.28 + (p * Math.PI * 2.1)
    const targetRotX = -0.16 + state.pointer.y * 0.12 + Math.sin(p * Math.PI * 2) * 0.1
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotY, 3, delta)
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetRotX, 3, delta)
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY + Math.sin(state.clock.elapsedTime * 0.8) * 0.08, 3, delta)
    const s = p < 0.2 ? 1.05 : p < 0.5 ? 1.0 : p < 0.75 ? 0.94 : 1.08
    group.current.scale.setScalar(THREE.MathUtils.damp(group.current.scale.x, s, 3, delta))
  })

  return <group ref={group} rotation={[0.04, -0.65, -0.08]} position={[0,-0.08,0]}>
    <primitive object={scene} onClick={(event: any) => { if (!interactive) return; event.stopPropagation(); if (event.object?.name) onSelectPart(event.object.name) }} />
    {partData.length > 0 && <mesh visible={false}><sphereGeometry args={[0.01]} /><meshBasicMaterial /></mesh>}
    {/* Invisible hit targets are avoided; real mesh clicks are wired by the parent Canvas event handler. */}
  </group>
}

function Loading() {
  return <Html center><div className="loading-model"><span className="loading-dot" /> LOADING YOUR CANVAS</div></Html>
}

export default function Experience({ progress, designIndex, customColors, selectedPart, onParts, onSelectPart, onReady, interactive = false }: {
  progress: React.MutableRefObject<number>; designIndex: number; customColors: Record<string,string>; selectedPart: string | null;
  onParts: (parts: PartInfo[]) => void; onSelectPart: (name: string) => void; onReady: (ready: boolean) => void; interactive?: boolean
}) {
  const { scene } = useGLTF('https://raw.githubusercontent.com/teddyjeremy/af1-interactive/main/models/nike%20shoes.glb')
  const handleClick = (event: any) => {
    if (!interactive) return
    event.stopPropagation()
    const name = event.object?.name
    if (name) onSelectPart(name)
  }
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.userData.af1Clickable = true
      }
    })
  }, [scene])

  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0.1, 0.2, 5.2], fov: 34 }} gl={{ antialias: true, alpha: true }} onPointerMissed={() => interactive && onSelectPart('')}>
    <color attach="background" args={['#0a0a0a']} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[4, 5, 5]} intensity={3.1} castShadow shadow-mapSize={[1024,1024]} />
    <spotLight position={[-4, 3, -3]} intensity={3.5} color="#ff4fa3" angle={0.6} penumbra={0.8} />
    <pointLight position={[3, -1, 2]} intensity={2.4} color={designs[designIndex].accent} />
    <Suspense fallback={<Loading />}>
      <Float speed={1.25} rotationIntensity={0.05} floatIntensity={0.13}>
        <Shoe progress={progress} designIndex={designIndex} customColors={customColors} selectedPart={selectedPart} onParts={onParts} onSelectPart={onSelectPart} onReady={onReady} interactive={interactive} />
      </Float>
      <Environment preset="studio" />
      <ContactShadows position={[0,-1.25,0]} opacity={0.32} scale={8} blur={2.4} far={4} />
    </Suspense>
    <OrbitControls enabled={interactive} enablePan={false} minDistance={3.5} maxDistance={7} minPolarAngle={Math.PI*0.25} maxPolarAngle={Math.PI*0.72} />
  </Canvas>
}
useGLTF.preload('https://raw.githubusercontent.com/teddyjeremy/af1-interactive/main/models/nike%20shoes.glb')
