import * as THREE from "three";
import type { Finish, Treatment } from "./parts";

export const MODEL_URL = "/models/shoe.glb";

export const FINISH_PROPS: Record<
  Finish,
  {
    roughness: number;
    metalness: number;
    clearcoat: number;
    clearcoatRoughness: number;
    iridescence: number;
    sheen: number;
    env: number;
  }
> = {
  leather: { roughness: 0.56, metalness: 0.02, clearcoat: 0.16, clearcoatRoughness: 0.42, iridescence: 0, sheen: 0.18, env: 0.85 },
  suede: { roughness: 0.96, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.6, iridescence: 0, sheen: 0.45, env: 0.35 },
  patent: { roughness: 0.16, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0, sheen: 0, env: 1.25 },
  metal: { roughness: 0.24, metalness: 0.92, clearcoat: 0.28, clearcoatRoughness: 0.18, iridescence: 0, sheen: 0, env: 1.15 },
  rubber: { roughness: 0.9, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.5, iridescence: 0, sheen: 0.04, env: 0.4 },
  pearl: { roughness: 0.3, metalness: 0.08, clearcoat: 0.7, clearcoatRoughness: 0.12, iridescence: 1, sheen: 0.22, env: 1.05 },
};

const TREAT_ID: Record<Treatment, number> = {
  plain: 0,
  grain: 1,
  halftone: 2,
  contour: 3,
};

const GLSL = /* glsl */ `
float chamberHash(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float chamberNoise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = chamberHash(i);
  float n100 = chamberHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = chamberHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = chamberHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = chamberHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = chamberHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = chamberHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = chamberHash(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}
float chamberMask(vec3 pos, vec3 nrm, float treat, float scale){
  if (treat < 0.5) return 1.0;
  vec3 p = pos * scale;
  if (treat < 1.5) {
    float g = chamberNoise(p);
    return mix(0.58, 1.0, g);
  }
  if (treat < 2.5) {
    vec3 bn = abs(normalize(nrm)) + vec3(0.0001);
    bn /= (bn.x + bn.y + bn.z);
    vec2 uv = p.yz * bn.x + p.xz * bn.y + p.xy * bn.z;
    vec2 cell = fract(uv) - 0.5;
    float r = 0.18 + 0.16 * chamberNoise(floor(p) * 0.17);
    float d = smoothstep(r, r - 0.06, length(cell));
    return mix(0.28, 1.0, d);
  }
  float band = abs(fract(pos.y * scale * 0.45) - 0.5);
  float line = smoothstep(0.035, 0.08, band);
  return mix(0.42, 1.0, line);
}
`;

export function treatmentId(treatment: Treatment) {
  return TREAT_ID[treatment];
}

export function toPhysical(src: THREE.Material, plane: THREE.Plane) {
  const standard = src as THREE.MeshStandardMaterial;
  const mat = new THREE.MeshPhysicalMaterial();
  mat.name = src.name;
  if (standard.isMeshStandardMaterial) {
    mat.color.copy(standard.color);
    mat.map = standard.map;
    mat.normalMap = standard.normalMap;
    if (standard.normalScale) mat.normalScale.copy(standard.normalScale);
    mat.aoMap = standard.aoMap;
    mat.roughness = standard.roughness;
    mat.metalness = standard.metalness;
    mat.side = standard.side;
    mat.transparent = standard.transparent;
    mat.alphaTest = standard.alphaTest;
    mat.depthWrite = standard.depthWrite;
  }
  mat.userData.srcMap = mat.map;
  mat.userData.treat = 0;
  mat.userData.treatScale = 11;
  mat.clippingPlanes = [plane];
  mat.clipShadows = true;
  injectTreatment(mat);
  return mat;
}

function injectTreatment(mat: THREE.MeshPhysicalMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTreat = { value: mat.userData.treat as number };
    shader.uniforms.uScale = { value: mat.userData.treatScale as number };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vChamberPos;\nvarying vec3 vChamberN;")
      .replace(
        "#include <project_vertex>",
        `vChamberPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vChamberN = normalize(mat3(modelMatrix) * objectNormal);
#include <project_vertex>`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vChamberPos;
varying vec3 vChamberN;
uniform float uTreat;
uniform float uScale;
${GLSL}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb *= chamberMask(vChamberPos, vChamberN, uTreat, uScale);`,
      );
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => "chamber-treat-v1";
}

export function woodMaterial(plane: THREE.Plane) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#7a4e2c",
    roughness: 0.78,
    metalness: 0.02,
    sheen: 0.35,
    sheenColor: new THREE.Color("#c4895a"),
    sheenRoughness: 0.7,
    clearcoat: 0.04,
    envMapIntensity: 0.45,
  });
  mat.clippingPlanes = [plane];
  mat.clipShadows = true;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  return mat;
}

export function mixFinish(a: Finish, b: Finish, t: number) {
  const fa = FINISH_PROPS[a];
  const fb = FINISH_PROPS[b];
  const m = (key: keyof typeof fa) => fa[key] + (fb[key] - fa[key]) * t;
  return {
    roughness: m("roughness"),
    metalness: m("metalness"),
    clearcoat: m("clearcoat"),
    clearcoatRoughness: m("clearcoatRoughness"),
    iridescence: m("iridescence"),
    sheen: m("sheen"),
    env: m("env"),
  };
}
