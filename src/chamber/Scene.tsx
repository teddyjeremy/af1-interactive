import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { Shoe } from "./Shoe";
import { registerShot } from "./shot";
import { useChamber, type CameraPreset } from "./store";

const FOV = 27;

type Fit = { radius: number; halfY: number };

function frameDistance(radius: number) {
  const half = THREE.MathUtils.degToRad(FOV) / 2;
  return (radius / Math.sin(half)) * 0.9;
}

function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function sampleKeys(
  keys: { t: number; dir: [number, number, number]; dist: number; look: [number, number, number] }[],
  p: number,
  distance: number,
  pos: THREE.Vector3,
  look: THREE.Vector3,
) {
  const progress = Math.min(1, Math.max(0, p));
  let i = 0;
  while (i < keys.length - 2 && progress > keys[i + 1].t) i += 1;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const span = Math.max(0.0001, b.t - a.t);
  const t = smooth((progress - a.t) / span);
  dir.set(
    THREE.MathUtils.lerp(a.dir[0], b.dir[0], t),
    THREE.MathUtils.lerp(a.dir[1], b.dir[1], t),
    THREE.MathUtils.lerp(a.dir[2], b.dir[2], t),
  );
  if (dir.lengthSq() < 1e-4) dir.set(0, 0.2, 1);
  dir.normalize();
  const dist = THREE.MathUtils.lerp(a.dist, b.dist, t) * distance;
  pos.copy(dir).multiplyScalar(dist);
  look.set(
    THREE.MathUtils.lerp(a.look[0], b.look[0], t),
    THREE.MathUtils.lerp(a.look[1], b.look[1], t),
    THREE.MathUtils.lerp(a.look[2], b.look[2], t),
  );
}

const PASS = [
  { t: 0, dir: [0.62, 0.2, 0.74] as [number, number, number], dist: 1.08, look: [0, -0.06, 0] as [number, number, number] },
  { t: 0.28, dir: [0.16, -0.12, 0.96] as [number, number, number], dist: 1.05, look: [0, -0.28, 0] as [number, number, number] },
  { t: 0.52, dir: [0.96, 0.14, 0.18] as [number, number, number], dist: 1.02, look: [0, 0.02, 0] as [number, number, number] },
  { t: 0.76, dir: [0.5, 0.22, 0.76] as [number, number, number], dist: 1.08, look: [0, -0.02, 0] as [number, number, number] },
  { t: 1, dir: [0.56, 0.2, 0.76] as [number, number, number], dist: 1.12, look: [0, -0.04, 0] as [number, number, number] },
];

const BENCH: Record<CameraPreset, { dir: [number, number, number]; dist: number; look: [number, number, number] }> = {
  three: { dir: [0.5, 0.26, 0.74], dist: 0.9, look: [0, 0.04, 0] },
  side: { dir: [1, 0.12, 0.02], dist: 0.86, look: [0, 0.02, 0] },
  front: { dir: [0.02, 0.16, 1], dist: 0.9, look: [0, 0.04, 0] },
  heel: { dir: [0.02, 0.18, -1], dist: 0.92, look: [0, 0.05, 0] },
  sole: { dir: [0.12, -0.55, 0.78], dist: 0.82, look: [0, -0.42, 0] },
  top: { dir: [0.12, 1, 0.18], dist: 0.95, look: [0, 0, 0] },
};

const wantPos = new THREE.Vector3(2.4, 1.1, 3.2);
const wantLook = new THREE.Vector3();
const dir = new THREE.Vector3();

function Rig({
  progressRef,
  fitRef,
  shellPlane,
  lastPlane,
}: {
  progressRef: React.RefObject<number>;
  fitRef: React.MutableRefObject<Fit>;
  shellPlane: THREE.Plane;
  lastPlane: THREE.Plane;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const presentation = useRef<THREE.Group>(null);
  const floor = useRef<THREE.Group>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const flying = useRef(true);
  const mode = useChamber((s) => s.mode);
  const cameraPreset = useChamber((s) => s.camera);
  const cameraNonce = useChamber((s) => s.cameraNonce);
  const lighting = useChamber((s) => s.lighting);
  const inspection = useChamber((s) => s.inspection);
  const { camera, gl } = useThree();

  useEffect(() => {
    if (spot.current) spot.current.castShadow = !inspection;
  }, [inspection]);

  useEffect(() => {
    registerShot(() => gl.domElement.toDataURL("image/png"));
    return () => registerShot(null);
  }, [gl]);

  useEffect(() => {
    gl.domElement.style.touchAction = mode === "pass" ? "pan-y" : "none";
  }, [gl, mode]);

  useEffect(() => {
    flying.current = true;
  }, [cameraNonce, mode]);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.08);
    const chamber = useChamber.getState();
    const reduced = chamber.reduced;
    const lambda = reduced ? 16 : mode === "pass" ? 3.4 : 4.2;
    const fit = fitRef.current;
    const distance = frameDistance(fit.radius || 1.25);
    const narrow = window.innerWidth < 780;
    const lift = chamber.mode === "bench" ? (narrow ? 0.02 : 0.58) : 0.14;
    const bob = chamber.mode === "pass" && !reduced ? Math.sin(state.clock.elapsedTime * 0.45) * 0.01 : 0;

    if (presentation.current) {
      presentation.current.position.x = THREE.MathUtils.damp(presentation.current.position.x, 0, lambda, d);
      presentation.current.position.y = THREE.MathUtils.damp(presentation.current.position.y, lift + bob, lambda, d);
      if (chamber.mode === "bench" && chamber.turntable && !reduced) {
        presentation.current.rotation.y += d * 0.34;
      } else {
        presentation.current.rotation.y = THREE.MathUtils.damp(presentation.current.rotation.y, 0, 5, d);
      }
    }
    if (floor.current) floor.current.position.y = -(fit.halfY || 0.7) - 0.02;

    if (chamber.mode === "pass") {
      sampleKeys(PASS, progressRef.current ?? 0, distance, wantPos, wantLook);
    } else if (flying.current) {
      const preset = BENCH[cameraPreset];
      dir.set(preset.dir[0], preset.dir[1], preset.dir[2]).normalize();
      wantPos.copy(dir).multiplyScalar(preset.dist * distance);
      wantLook.set(preset.look[0], preset.look[1], preset.look[2]);
    }

    if (chamber.mode === "pass" || flying.current) {
      const alpha = 1 - Math.exp(-lambda * d);
      camera.position.lerp(wantPos, reduced ? 1 : alpha);
      if (controls.current) {
        controls.current.target.lerp(wantLook, reduced ? 1 : alpha);
        controls.current.enabled = false;
        controls.current.update();
      }
      if (chamber.mode === "bench" && camera.position.distanceTo(wantPos) < 0.035) flying.current = false;
    } else if (controls.current) {
      controls.current.enabled = true;
    }

    if (key.current) key.current.intensity = (chamber.mode === "pass" ? 1.7 : 1.45) * chamber.lighting;
    if (rim.current) rim.current.intensity = 0.32 * chamber.lighting;
    if (spot.current) {
      spot.current.intensity = 26 * chamber.lighting;
      if (chamber.mode === "bench" && chamber.inspection && !reduced) {
        const sweep = state.clock.elapsedTime * 0.62;
        spot.current.position.set(Math.sin(sweep) * 3.6, 5.1, Math.cos(sweep) * 3.2);
      } else {
        spot.current.position.set(0.2, 7.4, 2.6);
      }
    }
    if (hemi.current) hemi.current.intensity = 0.28 * chamber.lighting;
  });

  return (
    <>
      <color attach="background" args={["#090909"]} />
      <hemisphereLight ref={hemi} args={["#f4efe4", "#14110e", 0.28]} />
      <spotLight
        ref={spot}
        position={[0.2, 7.4, 2.6]}
        angle={0.34}
        penumbra={1}
        intensity={26}
        color="#fffaf4"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <directionalLight
        ref={key}
        position={[2.8, 6.4, 2.4]}
        intensity={1.55}
        color="#fffaf4"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.4}
        shadow-camera-far={22}
        shadow-camera-left={-3.2}
        shadow-camera-right={3.2}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-3.2}
        shadow-bias={-0.00035}
        shadow-normalBias={0.04}
      />
      <directionalLight ref={rim} position={[-3.2, 2.4, -2.2]} intensity={0.32} color="#e7e2d8" />
      <directionalLight position={[-0.4, 1.4, 4.2]} intensity={0.22} color="#f7f4ee" />
      <group ref={presentation}>
        <Suspense fallback={null}>
          <Shoe progressRef={progressRef} shellPlane={shellPlane} lastPlane={lastPlane} fitRef={fitRef} />
        </Suspense>
        <group ref={floor}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[4.2, 64]} />
            <meshStandardMaterial color="#141311" roughness={1} metalness={0} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
            <ringGeometry args={[1.42, 1.435, 96]} />
            <meshBasicMaterial color="#c45c26" transparent opacity={0.42} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
            <ringGeometry args={[1.62, 1.626, 96]} />
            <meshBasicMaterial color="#a39888" transparent opacity={0.2} depthWrite={false} />
          </mesh>
        </group>
      </group>
      <Environment resolution={128} environmentIntensity={0.42 * lighting}>
        <Lightformer form="rect" intensity={1.4} position={[0, 3.6, -1.5]} scale={[5, 1.2, 1]} color="#fffaf4" />
        <Lightformer form="rect" intensity={0.35} position={[-3.2, 1.6, 1.2]} scale={[1.2, 2.2, 1]} color="#f3ecdf" />
        <Lightformer form="rect" intensity={0.45} position={[3.4, 1.2, 2]} scale={[1, 2.2, 1]} color="#f7f4ee" />
      </Environment>
      <OrbitControls
        ref={controls}
        enabled={mode === "bench"}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.7}
        maxDistance={9}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI * 0.92}
      />
    </>
  );
}

export function Scene({
  progressRef,
  hidden,
}: {
  progressRef: React.RefObject<number>;
  hidden: boolean;
}) {
  const shellPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 8), []);
  const lastPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 8), []);
  const fitRef = useRef<Fit>({ radius: 1.28, halfY: 0.7 });
  const lean = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches,
    [],
  );

  return (
    <Canvas
      className="h-full w-full"
      shadows={!lean}
      dpr={lean ? [1, 1.2] : [1, 1.5]}
      camera={{ fov: FOV, near: 0.05, far: 60, position: [2.2, 1.05, 3.4] }}
      frameloop={hidden ? "demand" : "always"}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
        localClippingEnabled: true,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.96;
        gl.setClearColor("#090909");
      }}
    >
      <Rig progressRef={progressRef} fitRef={fitRef} shellPlane={shellPlane} lastPlane={lastPlane} />
    </Canvas>
  );
}
