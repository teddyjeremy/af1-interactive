import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { isPartId, LAST_HIDDEN, PARTS, type PartId } from "./parts";
import { ORIGINAL, passPair } from "./presets";
import { mixFinish, MODEL_URL, toPhysical, treatmentId, woodMaterial } from "./materials";
import { useChamber } from "./store";

type Panel = {
  name: PartId;
  material: THREE.MeshPhysicalMaterial;
  object: THREE.Mesh;
  origin: THREE.Vector3;
  explode: THREE.Vector3;
  baseVisible: boolean;
};

const right = new THREE.Vector3();
const centerPos = new THREE.Vector3();
const planePoint = new THREE.Vector3();
const colorA = new THREE.Color();
const colorB = new THREE.Color();
const target = new THREE.Color();
const colorCache = new Map<string, THREE.Color>();

function colorOf(hex: string) {
  let color = colorCache.get(hex);
  if (!color) {
    color = new THREE.Color(hex);
    colorCache.set(hex, color);
  }
  return color;
}

function prepare(source: THREE.Object3D, shellPlane: THREE.Plane, lastPlane: THREE.Plane) {
  const box = new THREE.Box3().setFromObject(source);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 2.55 / maxDim;
  const sphere = box.getBoundingSphere(new THREE.Sphere());

  const shell = source.clone(true);
  shell.updateMatrixWorld(true);
  const shellCenter = new THREE.Box3().setFromObject(shell).getCenter(new THREE.Vector3());
  const panels: Panel[] = [];
  shell.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const srcMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const mat = toPhysical(srcMat, shellPlane);
    obj.material = mat;
    obj.castShadow = !/Stitch|Lace|Eyelet|Logo/.test(obj.name);
    obj.receiveShadow = false;
    if (isPartId(obj.name)) {
      obj.geometry.computeBoundingBox();
      const meshCenter = obj.geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
      obj.localToWorld(meshCenter);
      const radial = meshCenter.clone().sub(shellCenter);
      if (radial.lengthSq() < 1e-5) radial.set(0, 1, 0);
      radial.normalize();
      let localDirection = radial.clone();
      if (obj.parent) {
        const localOrigin = obj.parent.worldToLocal(meshCenter.clone());
        const localTip = obj.parent.worldToLocal(meshCenter.clone().add(radial));
        localDirection = localTip.sub(localOrigin).normalize();
      }
      const radius = meshCenter.distanceTo(shellCenter);
      const spread = (0.14 + 0.42 * Math.min(1, radius / (maxDim * 0.45))) / scale;
      panels.push({
        name: obj.name,
        material: mat,
        object: obj,
        origin: obj.position.clone(),
        explode: localDirection.multiplyScalar(spread),
        baseVisible: obj.visible,
      });
    }
  });

  const foundParts = new Set(panels.map((panel) => panel.name));
  const missingParts = PARTS.filter((name) => !foundParts.has(name));
  if (missingParts.length) {
    console.warn("[CHAMBER] GLB panels missing from the named-mesh hierarchy:", missingParts);
  }

  const last = shell.clone(true);
  const wood = woodMaterial(lastPlane);
  last.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.material = wood;
    obj.castShadow = false;
    obj.receiveShadow = false;
    obj.raycast = () => null;
    if (isPartId(obj.name) && LAST_HIDDEN.has(obj.name)) obj.visible = false;
  });

  return {
    shell,
    last,
    panels,
    wood,
    center,
    scale,
    halfY: (size.y * scale) / 2,
    radius: Math.max(sphere.radius * scale, 0.5),
  };
}

export function Shoe({
  progressRef,
  shellPlane,
  lastPlane,
  fitRef,
}: {
  progressRef: React.RefObject<number>;
  shellPlane: THREE.Plane;
  lastPlane: THREE.Plane;
  fitRef: React.MutableRefObject<{ radius: number; halfY: number }>;
}) {
  const gltf = useGLTF(MODEL_URL);
  const prepared = useMemo(
    () => prepare(gltf.scene, shellPlane, lastPlane),
    [gltf.scene, shellPlane, lastPlane],
  );
  const centerRef = useRef<THREE.Group>(null);
  const hover = useRef<PartId | null>(null);
  const prevSel = useRef("");
  const pulse = useRef(0);

  useLayoutEffect(() => {
    fitRef.current = { radius: prepared.radius, halfY: prepared.halfY };
  }, [fitRef, prepared.halfY, prepared.radius]);

  useLayoutEffect(() => {
    const { panels, wood } = prepared;
    return () => {
      for (const panel of panels) panel.material.dispose();
      wood.dispose();
    };
  }, [prepared]);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.08);
    const group = centerRef.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    group.getWorldPosition(centerPos);
    right.set(1, 0, 0).applyQuaternion(state.camera.quaternion).normalize();
    const chamber = useChamber.getState();
    const knife = chamber.knife;
    prepared.last.visible = knife > 0.015;
    const scroll = progressRef.current ?? 0;
    // The campaign sequence is choreographed in three beats: pull apart, orbit,
    // then click back into place. The complete orbit happens while the shoe is exploded.
    const rise = THREE.MathUtils.smoothstep(scroll, 0.18, 0.32);
    const settle = 1 - THREE.MathUtils.smoothstep(scroll, 0.50, 0.59);
    const cinematicExplosion = rise * settle * 0.96;
    const explosion = chamber.mode === "bench" ? chamber.explosion : cinematicExplosion;
    const orbit = THREE.MathUtils.smoothstep(scroll, 0.31, 0.50) * Math.PI * 2;
    group.rotation.y =
      chamber.mode === "pass" && !chamber.reduced
        ? orbit
        : THREE.MathUtils.damp(group.rotation.y, 0, 5, d);
    const hiddenParts = new Set(chamber.mode === "bench" ? chamber.hiddenParts : []);
    for (const panel of prepared.panels) {
      panel.object.position.x = THREE.MathUtils.damp(panel.object.position.x, panel.origin.x + panel.explode.x * explosion, 8, d);
      panel.object.position.y = THREE.MathUtils.damp(panel.object.position.y, panel.origin.y + panel.explode.y * explosion, 8, d);
      panel.object.position.z = THREE.MathUtils.damp(panel.object.position.z, panel.origin.z + panel.explode.z * explosion, 8, d);
      panel.object.visible = panel.baseVisible && !hiddenParts.has(panel.name);
    }
    const along = THREE.MathUtils.lerp(-1.7, 1.7, knife);
    planePoint.copy(centerPos).addScaledVector(right, along);
    shellPlane.setFromNormalAndCoplanarPoint(right, planePoint);
    lastPlane.copy(shellPlane).negate();
    paint(prepared.panels, progressRef.current ?? 0, d, hover.current, prevSel, pulse);
    const canvas = state.gl.domElement;
    canvas.style.cursor = hover.current ? "pointer" : "";
  });

  return (
    <group ref={centerRef} scale={prepared.scale}>
      <group position={[-prepared.center.x, -prepared.center.y, -prepared.center.z]}>
        <primitive
          object={prepared.shell}
          onClick={(event: { stopPropagation: () => void; object: THREE.Object3D }) => {
            event.stopPropagation();
            if (useChamber.getState().mode !== "bench") return;
            if (!isPartId(event.object.name)) return;
            useChamber.getState().select([event.object.name]);
          }}
          onDoubleClick={(event: { stopPropagation: () => void; object: THREE.Object3D }) => {
            event.stopPropagation();
            if (useChamber.getState().mode !== "bench") return;
            if (!isPartId(event.object.name)) return;
            useChamber.getState().select([event.object.name]);
            useChamber.getState().isolate(event.object.name);
          }}
          onPointerOver={(event: { stopPropagation: () => void; object: THREE.Object3D }) => {
            event.stopPropagation();
            if (isPartId(event.object.name)) hover.current = event.object.name;
          }}
          onPointerOut={() => {
            hover.current = null;
          }}
        />
        <group scale={0.972}>
          <primitive object={prepared.last} />
        </group>
      </group>
    </group>
  );
}

function paint(
  panels: Panel[],
  progress: number,
  delta: number,
  hover: PartId | null,
  prevSel: React.MutableRefObject<string>,
  pulse: React.MutableRefObject<number>,
) {
  const chamber = useChamber.getState();
  const sample =
    chamber.mode === "bench"
      ? {
          from: chamber.compareOriginal ? ORIGINAL : chamber.design,
          to: chamber.compareOriginal ? ORIGINAL : chamber.design,
          t: 0,
        }
      : passPair(progress);
  const selected = new Set(chamber.selected);
  const selKey = chamber.selected.join("|");
  if (prevSel.current !== selKey) {
    prevSel.current = selKey;
    pulse.current = 1;
  }
  pulse.current = Math.max(0, pulse.current - delta * 1.35);
  const damp = 1 - Math.exp(-7 * delta);

  for (const panel of panels) {
    const from = sample.from.parts[panel.name];
    const to = sample.to.parts[panel.name];
    const mat = panel.material;
    colorA.copy(colorOf(from.color));
    colorB.copy(colorOf(to.color));
    target.copy(colorA).lerp(colorB, sample.t);
    if (chamber.isolated && chamber.isolated !== panel.name) target.multiplyScalar(0.08);
    mat.color.lerp(target, damp);

    const finish = mixFinish(from.finish, to.finish, sample.t);
    mat.roughness = THREE.MathUtils.damp(mat.roughness, finish.roughness, 7, delta);
    mat.metalness = THREE.MathUtils.damp(mat.metalness, finish.metalness, 7, delta);
    mat.clearcoat = THREE.MathUtils.damp(mat.clearcoat, finish.clearcoat, 7, delta);
    mat.clearcoatRoughness = THREE.MathUtils.damp(mat.clearcoatRoughness, finish.clearcoatRoughness, 7, delta);
    mat.iridescence = THREE.MathUtils.damp(mat.iridescence, finish.iridescence, 7, delta);
    mat.sheen = THREE.MathUtils.damp(mat.sheen, finish.sheen, 7, delta);
    mat.sheenColor.set("#f4efe6");
    mat.envMapIntensity = THREE.MathUtils.damp(mat.envMapIntensity, finish.env, 7, delta);
    mat.wireframe = chamber.mode === "bench" ? chamber.wireframe : progress > 0.455 && progress < 0.57;

    const treat = sample.t < 0.5 ? from.treatment : to.treatment;
    const treatValue = treatmentId(treat);
    mat.userData.treat = treatValue;
    const shader = mat.userData.shader as { uniforms: { uTreat: { value: number } } } | undefined;
    if (shader) shader.uniforms.uTreat.value = treatValue;

    const nextMap = chamber.prints && mat.userData.srcMap ? (mat.userData.srcMap as THREE.Texture) : null;
    if (mat.map !== nextMap) {
      mat.map = nextMap;
      mat.needsUpdate = true;
    }

    const hot = selected.has(panel.name);
    const over = hover === panel.name;
    mat.emissive.set(hot || over ? "#c45c26" : "#000000");
    mat.emissiveIntensity = hot ? 0.08 + pulse.current * 0.2 : over ? 0.04 : 0;
  }
}

useGLTF.preload(MODEL_URL);
