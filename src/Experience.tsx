import { Suspense, useEffect, useMemo, useRef } from 'react'
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

function materialList(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material : [material]
}
function readColor(material: THREE.Material) {
  const candidate = material as THREE.MeshStandardMaterial
  return candidate.color?.isColor ? '#' + candidate.color.getHexString() : '#f5f0e6'
}
function colorForMesh(name: string, palette: string[]) {
  const hash = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}
function normalizeName(name: string) {
  return name.replace(/^AF1[_\s-]*/i, '').replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
}

function Shoe({ progress, designIndex, customColors, selectedPart, finish, onParts, onSelectPart, onReady, interactive = false }: {
  progress: React.MutableRefObject<number>; designIndex: number; customColors: Record<string,string>; selectedPart: string | null; finish: string;
  onParts: (parts: PartInfo[]) => void; onSelectPart: (name: string) => void; onReady: (ready: boolean) => void; interactive?: boolean
}) {
  const { scene } = useGLTF('https://raw.githubusercontent.com/teddyjeremy/af1-interactive/main/models/nike%20shoes.glb')
  const group = useRef<THREE.Group>(null)
  const prepared = useMemo(() => {
    const copy = scene.clone(true)
    copy.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const cloneMaterial = (material: THREE.Material) => {
        const next = material.clone()
        const standard = next as THREE.MeshStandardMaterial
        if (standard.color?.isColor) next.userData.af1OriginalColor = standard.color.getHexString()
        if ('roughness' in standard) next.userData.af1OriginalRoughness = standard.roughness
        if ('metalness' in standard) next.userData.af1OriginalMetalness = standard.metalness
        return next
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material)
      object.castShadow = true
      object.receiveShadow = true
    })
    const bounds = new THREE.Box3().setFromObject(copy)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
    // Normalize around the actual GLB bounds so camera distance is independent of export units.
    const scale = 2.85 / maxDimension
    return { scene: copy, center, scale, size }
  }, [scene])

  useEffect(() => {
    const grouped = new Map<string, PartInfo>()
    prepared.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const name = object.name || 'Unnamed part'
      const mats = materialList(object.material)
      const info = grouped.get(name) ?? { name, materialNames: [], color: readColor(mats[0]), meshCount: 0 }
      info.meshCount += 1
      mats.forEach((mat) => {
        const label = mat.name || 'Default material'
        if (!info.materialNames.includes(label)) info.materialNames.push(label)
      })
      grouped.set(name, info)
    })
    onParts(Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name)))
    onReady(true)
    return () => onReady(false)
  }, [prepared, onParts, onReady])

  useEffect(() => {
    prepared.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const mats = materialList(object.material)
      const custom = customColors[object.name]
      const designColor = colorForMesh(object.name, designs[designIndex].colors)
      mats.forEach((material) => {
        const mat = material as THREE.MeshStandardMaterial
        if (!mat.color?.isColor) return
        const original = mat.userData.af1OriginalColor as string | undefined
        mat.color.set('#' + (original ?? 'f5f0e6'))
        mat.color.multiply(new THREE.Color(custom || designColor))
        const finishSettings: Record<string, { roughness: number; metalness: number }> = {
          matte: { roughness: 0.92, metalness: 0.02 },
          satin: { roughness: 0.55, metalness: 0.04 },
          gloss: { roughness: 0.28, metalness: 0.06 },
          'high-gloss': { roughness: 0.12, metalness: 0.08 },
          metallic: { roughness: 0.24, metalness: 0.72 },
        }
        const selectedFinish = finishSettings[finish] ?? finishSettings.satin
        if ('roughness' in mat) mat.roughness = selectedFinish.roughness
        if ('metalness' in mat) mat.metalness = selectedFinish.metalness
        mat.needsUpdate = true
      })
    })
  }, [prepared, designIndex, customColors, selectedPart, finish])

  useFrame((state, delta) => {
    if (!group.current) return
    const p = interactive ? 0 : progress.current
    const targetY = p < 0.18 ? 0.03 : p < 0.42 ? -0.12 : p < 0.68 ? 0.02 : 0.1
    const targetRotY = (interactive ? 0 : p * Math.PI * 1.35) + (interactive ? 0 : state.pointer.x * 0.04)
    const targetRotX = interactive ? 0.02 : -0.12 + Math.sin(p * Math.PI * 2) * 0.045
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotY, 3, delta)
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetRotX, 3, delta)
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY + Math.sin(state.clock.elapsedTime * 0.65) * 0.035, 3, delta)
    const scale = interactive ? 1 : p < 0.2 ? 1.03 : p < 0.5 ? 1 : p < 0.75 ? 0.98 : 1.04
    group.current.scale.setScalar(THREE.MathUtils.damp(group.current.scale.x, scale, 3, delta))
  })

  return <group ref={group}>
    <group scale={prepared.scale} rotation={[0.04, -0.52, -0.04]}>
      <primitive
        object={prepared.scene}
        position={[-prepared.center.x, -prepared.center.y, -prepared.center.z]}
        onClick={(event: { stopPropagation: () => void; object?: THREE.Object3D }) => {
          if (!interactive) return
          event.stopPropagation()
          if (event.object?.name) onSelectPart(event.object.name)
        }}
      />
    </group>
  </group>
}

function Loading() {
  return <Html center><div className="loading-model"><span className="loading-dot" /> LOADING YOUR CANVAS</div></Html>
}

export default function Experience({ progress, designIndex, customColors, selectedPart, finish, onParts, onSelectPart, onReady, interactive = false }: {
  progress: React.MutableRefObject<number>; designIndex: number; customColors: Record<string,string>; selectedPart: string | null; finish: string;
  onParts: (parts: PartInfo[]) => void; onSelectPart: (name: string) => void; onReady: (ready: boolean) => void; interactive?: boolean
}) {
  const { scene } = useGLTF('https://raw.githubusercontent.com/teddyjeremy/af1-interactive/main/models/nike%20shoes.glb')
  const cameraDistance = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(scene)
    const size = bounds.getSize(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
    return Math.max(3.8, (maxDimension * (2.85 / maxDimension)) * 1.45)
  }, [scene])

  return <Canvas
    shadows
    dpr={[1, 1.35]}
    camera={{ position: [0.1, 0.18, cameraDistance], fov: 31, near: 0.01, far: 100 }}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    onPointerMissed={() => interactive && onSelectPart('')}
  >
    <color attach="background" args={['#0a0a0a']} />
    <ambientLight intensity={1.25} />
    <directionalLight position={[4, 5, 5]} intensity={2.8} castShadow shadow-mapSize={[1024, 1024]} />
    <spotLight position={[-4, 3, -3]} intensity={2.8} color="#ff4fa3" angle={0.6} penumbra={0.8} />
    <pointLight position={[3, -1, 2]} intensity={1.8} color={designs[designIndex].accent} />
    <Suspense fallback={<Loading />}>
      <Float speed={1.1} rotationIntensity={interactive ? 0 : 0.025} floatIntensity={interactive ? 0 : 0.05}>
        <Shoe progress={progress} designIndex={designIndex} customColors={customColors} selectedPart={selectedPart} finish={finish} onParts={onParts} onSelectPart={onSelectPart} onReady={onReady} interactive={interactive} />
      </Float>
      <Environment preset="studio" />
      <ContactShadows position={[0, -1.05, 0]} opacity={0.3} scale={5} blur={2.2} far={3.5} />
    </Suspense>
    <OrbitControls
      enabled={interactive}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={2.8}
      maxDistance={6.5}
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.82}
      target={[0, 0, 0]}
    />
  </Canvas>
}
useGLTF.preload('https://raw.githubusercontent.com/teddyjeremy/af1-interactive/main/models/nike%20shoes.glb')
