"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

type StageId = "polyhedral" | "conformal" | "ideal" | "spherical";

const STAGES: Array<{
  id: StageId;
  number: string;
  shortName: string;
  name: string;
  kind: string;
  equation: string;
}> = [
  {
    id: "polyhedral",
    number: "01",
    shortName: "Polyhedral",
    name: "Polyhedral metric",
    kind: "INPUT · FLAT FACES",
    equation: "ℓ : E → ℝ₊",
  },
  {
    id: "conformal",
    number: "02",
    shortName: "Conformal",
    name: "Discrete conformal metric",
    kind: "CONFORMAL CLASS · VERTEX SCALES",
    equation: "ℓ̃ᵢⱼ = e⁽ᵘⁱ⁺ᵘʲ⁾⁄² ℓᵢⱼ",
  },
  {
    id: "ideal",
    number: "03",
    shortName: "Ideal H³",
    name: "Ideal hyperbolic model",
    kind: "HYPERBOLIC VIEW · POINCARÉ BALL",
    equation: "vᵢ ∈ ∂∞ℍ³ ≅ S²",
  },
  {
    id: "spherical",
    number: "04",
    shortName: "Spherical",
    name: "Spherical uniformization",
    kind: "TARGET · GENUS ZERO",
    equation: "Φ : M → S²",
  },
];

const PHI = (1 + Math.sqrt(5)) / 2;
const RAW_VERTICES = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
] as const;

const FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
] as const;

const DIRECTIONS = RAW_VERTICES.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
const SUBDIVISIONS = 7;
const EDGE_SEGMENTS = 18;
const IDEAL_RADIUS = 1.42;
const DISPLAY_RADIUS = 1.24;

type Sample = {
  face: number;
  bary: [number, number, number];
  uv: [number, number];
};

type Display = {
  group: THREE.Group;
  surface: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  edges: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  vertices: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  boundary: THREE.Group;
  samples: Sample[];
  stage: StageId;
  opacity: number;
};

function mobiusDirection(direction: THREE.Vector3, amount: number) {
  const denominator = Math.max(1e-5, 1 - direction.z);
  const px = direction.x / denominator;
  const py = direction.y / denominator;
  const scale = Math.exp(0.22 * amount);
  const x = scale * px + 0.44 * amount;
  const y = scale * py - 0.2 * amount;
  const d = x * x + y * y + 1;
  return new THREE.Vector3(2 * x / d, 2 * y / d, (x * x + y * y - 1) / d).normalize();
}

function unwrapFaceUvs(face: readonly [number, number, number]) {
  const uv = face.map((index) => {
    const p = DIRECTIONS[index];
    return [0.5 + Math.atan2(p.z, p.x) / (Math.PI * 2), Math.acos(THREE.MathUtils.clamp(p.y, -1, 1)) / Math.PI] as [number, number];
  });
  const values = uv.map(([u]) => u);
  if (Math.max(...values) - Math.min(...values) > 0.5) {
    uv.forEach((pair) => {
      if (pair[0] < 0.5) pair[0] += 1;
    });
  }
  return uv;
}

function makeSample(faceIndex: number, bary: [number, number, number], faceUvs: Array<[number, number]>): Sample {
  return {
    face: faceIndex,
    bary,
    uv: [
      bary[0] * faceUvs[0][0] + bary[1] * faceUvs[1][0] + bary[2] * faceUvs[2][0],
      bary[0] * faceUvs[0][1] + bary[1] * faceUvs[1][1] + bary[2] * faceUvs[2][1],
    ],
  };
}

function createSamples() {
  const samples: Sample[] = [];
  FACES.forEach((face, faceIndex) => {
    const faceUvs = unwrapFaceUvs(face);
    const q = (row: number, column: number): Sample => makeSample(
      faceIndex,
      [1 - row / SUBDIVISIONS, (row - column) / SUBDIVISIONS, column / SUBDIVISIONS],
      faceUvs,
    );
    for (let row = 0; row < SUBDIVISIONS; row += 1) {
      for (let column = 0; column <= row; column += 1) {
        const a = q(row, column);
        const b = q(row + 1, column);
        const c = q(row + 1, column + 1);
        samples.push(a, b, c);
        if (column < row) samples.push(a, c, q(row, column + 1));
      }
    }
  });
  return samples;
}

function vertexDirections(stage: StageId, conformalProgress: number) {
  const warp = stage === "polyhedral"
    ? 1
    : stage === "conformal"
      ? THREE.MathUtils.lerp(1, 0.08, conformalProgress)
      : stage === "ideal"
        ? 0.08
        : 0;
  return DIRECTIONS.map((direction) => mobiusDirection(direction, warp));
}

// The projective Klein ball and conformal Poincaré ball describe the same
// hyperbolic point. This radial conversion turns Klein chords and planes into
// the circular geodesics and orthogonal spherical patches seen in Poincaré.
function kleinToPoincare(point: THREE.Vector3) {
  const radiusSquared = THREE.MathUtils.clamp(point.lengthSq(), 0, 1);
  const denominator = 1 + Math.sqrt(Math.max(0, 1 - radiusSquared));
  return point.clone().multiplyScalar(1 / denominator);
}

function samplePosition(sample: Sample, stage: StageId, conformalProgress: number, vertices: THREE.Vector3[]) {
  const face = FACES[sample.face];
  const point = new THREE.Vector3()
    .addScaledVector(vertices[face[0]], sample.bary[0])
    .addScaledVector(vertices[face[1]], sample.bary[1])
    .addScaledVector(vertices[face[2]], sample.bary[2]);

  if (stage === "spherical") return point.normalize().multiplyScalar(1.34);
  if (stage === "ideal") return kleinToPoincare(point).multiplyScalar(IDEAL_RADIUS);
  return point.multiplyScalar(DISPLAY_RADIUS);
}

function uniqueEdges() {
  const map = new Map<string, [number, number]>();
  FACES.forEach((face) => {
    for (let i = 0; i < 3; i += 1) {
      const a = face[i];
      const b = face[(i + 1) % 3];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!map.has(key)) map.set(key, a < b ? [a, b] : [b, a]);
    }
  });
  return [...map.values()];
}

const EDGES = uniqueEdges();

function slerpUnit(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const angle = Math.acos(dot);
  if (angle < 1e-6) return a.clone();
  const sin = Math.sin(angle);
  return a.clone().multiplyScalar(Math.sin((1 - t) * angle) / sin)
    .addScaledVector(b, Math.sin(t * angle) / sin)
    .normalize();
}

function createBoundary(material: THREE.LineBasicMaterial) {
  const group = new THREE.Group();
  const axes: Array<"xy" | "xz" | "yz"> = ["xy", "xz", "yz"];
  axes.forEach((axis) => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 96; i += 1) {
      const angle = (i / 96) * Math.PI * 2;
      const c = Math.cos(angle) * IDEAL_RADIUS;
      const s = Math.sin(angle) * IDEAL_RADIUS;
      points.push(axis === "xy" ? new THREE.Vector3(c, s, 0) : axis === "xz" ? new THREE.Vector3(c, 0, s) : new THREE.Vector3(0, c, s));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.LineLoop(geometry, material));
  });
  return group;
}

function createDisplay() {
  const samples = createSamples();
  const positions = new Float32Array(samples.length * 3);
  const uvs = new Float32Array(samples.length * 2);
  samples.forEach((sample, index) => {
    uvs[index * 2] = sample.uv[0];
    uvs[index * 2 + 1] = sample.uv[1];
  });

  const surfaceGeometry = new THREE.BufferGeometry();
  surfaceGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  surfaceGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  const surfaceMaterial = new THREE.ShaderMaterial({
    uniforms: {
      colorA: { value: new THREE.Color(0xeee8dc) },
      colorB: { value: new THREE.Color(0x9fb5c8) },
      lineTint: { value: new THREE.Color(0x123f69) },
      lightDirection: { value: new THREE.Vector3(-0.42, 0.82, 0.5).normalize() },
      opacityValue: { value: 1 },
      checkerStrength: { value: 0.68 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform vec3 lineTint;
      uniform vec3 lightDirection;
      uniform float opacityValue;
      uniform float checkerStrength;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vec2 cell = floor(vUv * vec2(12.0, 9.0));
        float checker = mod(cell.x + cell.y, 2.0);
        vec3 base = mix(colorA, colorB, checker * checkerStrength);
        float light = 0.78 + 0.3 * max(dot(normalize(vNormal), lightDirection), 0.0);
        float edge = smoothstep(0.0, 0.018, min(fract(vUv.x * 12.0), fract(vUv.y * 9.0)));
        base = mix(lineTint, base, 0.94 + 0.06 * edge);
        gl_FragColor = vec4(base * light, opacityValue);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(EDGES.length * EDGE_SEGMENTS * 2 * 3), 3));
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x143f67,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const vertexGeometry = new THREE.BufferGeometry();
  vertexGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DIRECTIONS.length * 3), 3));
  const vertexMaterial = new THREE.PointsMaterial({ color: 0xed5b50, size: 4.2, sizeAttenuation: false, transparent: true, opacity: 0.78 });

  const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x718492, transparent: true, opacity: 0.18 });
  const boundary = createBoundary(boundaryMaterial);
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  const vertices = new THREE.Points(vertexGeometry, vertexMaterial);
  surface.renderOrder = 0;
  boundary.renderOrder = 1;
  edges.renderOrder = 2;
  vertices.renderOrder = 3;
  const group = new THREE.Group();
  group.add(surface, edges, vertices, boundary);

  return { group, surface, edges, vertices, boundary, samples, stage: "polyhedral" as StageId, opacity: 1 };
}

function updateDisplay(display: Display, stage: StageId, conformalProgress: number) {
  display.stage = stage;
  const vertices = vertexDirections(stage, conformalProgress);
  const surfaceArray = (display.surface.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  display.samples.forEach((sample, index) => {
    samplePosition(sample, stage, conformalProgress, vertices).toArray(surfaceArray, index * 3);
  });
  const surfaceAttribute = display.surface.geometry.getAttribute("position") as THREE.BufferAttribute;
  surfaceAttribute.needsUpdate = true;
  display.surface.geometry.computeVertexNormals();

  const edgeArray = (display.edges.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  let offset = 0;
  EDGES.forEach(([aIndex, bIndex]) => {
    const a = vertices[aIndex];
    const b = vertices[bIndex];
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const t0 = segment / EDGE_SEGMENTS;
      const t1 = (segment + 1) / EDGE_SEGMENTS;
      const chord0 = a.clone().lerp(b, t0);
      const chord1 = a.clone().lerp(b, t1);
      const p0 = stage === "spherical"
        ? slerpUnit(a, b, t0).multiplyScalar(1.34)
        : stage === "ideal"
          ? kleinToPoincare(chord0).multiplyScalar(IDEAL_RADIUS)
          : chord0.multiplyScalar(DISPLAY_RADIUS);
      const p1 = stage === "spherical"
        ? slerpUnit(a, b, t1).multiplyScalar(1.34)
        : stage === "ideal"
          ? kleinToPoincare(chord1).multiplyScalar(IDEAL_RADIUS)
          : chord1.multiplyScalar(DISPLAY_RADIUS);
      p0.toArray(edgeArray, offset);
      p1.toArray(edgeArray, offset + 3);
      offset += 6;
    }
  });
  (display.edges.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

  const vertexArray = (display.vertices.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  const radius = stage === "ideal" ? IDEAL_RADIUS : stage === "spherical" ? 1.34 : DISPLAY_RADIUS;
  vertices.forEach((vertex, index) => vertex.clone().multiplyScalar(radius).toArray(vertexArray, index * 3));
  (display.vertices.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  display.boundary.visible = stage === "ideal";
  display.surface.material.depthWrite = stage !== "ideal";
}

function setDisplayOpacity(display: Display, opacity: number) {
  display.opacity = opacity;
  const idealFactor = display.stage === "ideal" ? 0.7 : 1;
  display.surface.material.uniforms.opacityValue.value = opacity * idealFactor;
  display.edges.material.opacity = opacity * (display.stage === "ideal" ? 0.88 : 0.72);
  display.vertices.material.opacity = opacity * 0.82;
  display.boundary.children.forEach((child) => {
    ((child as THREE.Line).material as THREE.LineBasicMaterial).opacity = opacity * 0.18;
  });
  display.group.visible = opacity > 0.001;
}

function disposeDisplay(display: Display) {
  display.surface.geometry.dispose();
  display.surface.material.dispose();
  display.edges.geometry.dispose();
  display.edges.material.dispose();
  display.vertices.geometry.dispose();
  display.vertices.material.dispose();
  display.boundary.children.forEach((child) => {
    (child as THREE.Line).geometry.dispose();
  });
  const boundaryMaterial = (display.boundary.children[0] as THREE.Line).material as THREE.LineBasicMaterial;
  boundaryMaterial.dispose();
}

function MetricFallbackArt({ stage }: { stage: StageId }) {
  if (stage === "ideal") {
    return (
      <svg className="metric-fallback" viewBox="0 0 520 330" aria-hidden="true">
        <defs><clipPath id="ideal-boundary"><circle cx="260" cy="165" r="126" /></clipPath></defs>
        <circle className="metric-fallback-boundary" cx="260" cy="165" r="126" />
        <g clipPath="url(#ideal-boundary)" className="metric-fallback-ideal">
          <path className="metric-fallback-fill-a" d="M260 39 Q292 104 260 151 Q228 104 260 39Z" />
          <path className="metric-fallback-fill-b" d="M360 89 Q303 116 270 156 Q330 152 386 190 Q389 132 360 89Z" />
          <path className="metric-fallback-fill-a" d="M386 190 Q319 185 268 169 Q301 216 314 272 Q365 241 386 190Z" />
          <path className="metric-fallback-fill-b" d="M314 272 Q280 210 256 174 Q230 221 190 272 Q254 289 314 272Z" />
          <path className="metric-fallback-fill-a" d="M190 272 Q212 210 246 168 Q190 188 134 174 Q144 236 190 272Z" />
          <path className="metric-fallback-fill-b" d="M134 174 Q198 161 246 157 Q201 124 164 76 Q126 118 134 174Z" />
          <path className="metric-fallback-fill-a" d="M164 76 Q220 111 252 151 Q230 91 260 39 Q204 37 164 76Z" />
          <path className="metric-fallback-lines" d="M260 39 Q292 104 260 151 Q228 104 260 39M360 89 Q303 116 270 156 Q330 152 386 190 Q389 132 360 89M386 190 Q319 185 268 169 Q301 216 314 272 Q365 241 386 190M314 272 Q280 210 256 174 Q230 221 190 272 Q254 289 314 272M190 272 Q212 210 246 168 Q190 188 134 174 Q144 236 190 272M134 174 Q198 161 246 157 Q201 124 164 76 Q126 118 134 174M164 76 Q220 111 252 151 Q230 91 260 39 Q204 37 164 76" />
          <path className="metric-fallback-lines metric-fallback-soft" d="M260 151 Q265 158 270 156M270 156 Q268 162 268 169M268 169 Q262 171 256 174M256 174 Q250 171 246 168M246 168 Q244 162 246 157M246 157 Q253 153 260 151" />
        </g>
        {["260,39", "360,89", "386,190", "314,272", "190,272", "134,174", "164,76"].map((point) => {
          const [cx, cy] = point.split(",");
          return <circle key={point} className="metric-fallback-point" cx={cx} cy={cy} r="3.2" />;
        })}
        <text className="metric-fallback-label" x="378" y="49">∂ℍ³</text>
      </svg>
    );
  }

  if (stage === "spherical") {
    return (
      <svg className="metric-fallback" viewBox="0 0 520 330" aria-hidden="true">
        <circle className="metric-fallback-fill-a" cx="260" cy="165" r="126" />
        <path className="metric-fallback-fill-b" d="M260 39C313 62 343 106 350 165C343 224 313 268 260 291C207 268 177 224 170 165C177 106 207 62 260 39Z" />
        <path className="metric-fallback-lines" d="M260 39C313 62 343 106 350 165C343 224 313 268 260 291C207 268 177 224 170 165C177 106 207 62 260 39ZM134 165C176 137 218 127 260 127C302 127 344 137 386 165M134 165C176 193 218 203 260 203C302 203 344 193 386 165M260 39C227 84 211 126 211 165C211 204 227 246 260 291M260 39C293 84 309 126 309 165C309 204 293 246 260 291M170 91C207 111 237 121 260 127C283 121 313 111 350 91M170 239C207 219 237 209 260 203C283 209 313 219 350 239" />
        <circle className="metric-fallback-outline" cx="260" cy="165" r="126" />
        <circle className="metric-fallback-point" cx="260" cy="39" r="3.2" />
        <circle className="metric-fallback-point" cx="386" cy="165" r="3.2" />
        <circle className="metric-fallback-point" cx="260" cy="291" r="3.2" />
        <circle className="metric-fallback-point" cx="134" cy="165" r="3.2" />
      </svg>
    );
  }

  const conformal = stage === "conformal";
  return (
    <svg className="metric-fallback" viewBox="0 0 520 330" aria-hidden="true">
      <g transform={conformal ? "translate(18 -4) skewX(-5)" : undefined}>
        <path className="metric-fallback-fill-a" d="M258 45 350 76 404 157 368 248 275 286 170 252 112 169 150 83Z" />
        <path className="metric-fallback-fill-b" d="M258 45 265 160 350 76ZM350 76 265 160 404 157ZM404 157 265 160 368 248ZM368 248 265 160 275 286ZM275 286 265 160 170 252ZM170 252 265 160 112 169ZM112 169 265 160 150 83ZM150 83 265 160 258 45Z" />
        <path className="metric-fallback-lines" d="M258 45 350 76 404 157 368 248 275 286 170 252 112 169 150 83ZM258 45 265 160 350 76M404 157 265 160 368 248M275 286 265 160 170 252M112 169 265 160 150 83" />
        <path className="metric-fallback-lines metric-fallback-soft" d="M150 83 350 76M112 169 170 252M404 157 275 286" />
        <circle className="metric-fallback-point" cx={conformal ? "404" : "258"} cy={conformal ? "157" : "45"} r="4" />
      </g>
      {conformal && <path className="metric-fallback-arrow" d="M104 270C138 250 164 235 198 225" />}
    </svg>
  );
}

export default function MetricGallery() {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageId>("polyhedral");
  const enteredAtRef = useRef(0);
  const [stage, setStage] = useState<StageId>("polyhedral");
  const [isPlaying, setIsPlaying] = useState(true);
  const [cycleKey, setCycleKey] = useState(0);

  const selectStage = useCallback((next: StageId, manual = true) => {
    stageRef.current = next;
    enteredAtRef.current = performance.now();
    setStage(next);
    if (manual) setIsPlaying(false);
  }, []);

  const replay = useCallback(() => {
    setIsPlaying(true);
    setCycleKey((key) => key + 1);
    selectStage("polyhedral", false);
  }, [selectStage]);

  useEffect(() => {
    enteredAtRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      const index = STAGES.findIndex((item) => item.id === stageRef.current);
      selectStage(STAGES[(index + 1) % STAGES.length].id, false);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [cycleKey, isPlaying, selectStage]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.set(0.35, 2.25, 5.1);
    camera.lookAt(0, 0, 0);

    const renderCanvas = document.createElement("canvas");
    const context = renderCanvas.getContext("webgl2") ?? renderCanvas.getContext("webgl");
    if (!context) {
      mount.dataset.webglUnavailable = "true";
      return () => { delete mount.dataset.webglUnavailable; };
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: renderCanvas,
        context,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      mount.dataset.webglUnavailable = "true";
      return () => { delete mount.dataset.webglUnavailable; };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    mount.dataset.webglReady = "true";

    const root = new THREE.Group();
    root.rotation.set(-0.12, -0.34, 0.02);
    const displays: [Display, Display] = [createDisplay(), createDisplay()];
    displays.forEach((display) => root.add(display.group));
    scene.add(root);
    updateDisplay(displays[0], "polyhedral", 0);
    updateDisplay(displays[1], "polyhedral", 0);
    setDisplayOpacity(displays[0], 1);
    setDisplayOpacity(displays[1], 0);

    let activeDisplay = 0;
    let renderedStage = stageRef.current;
    let previousStage = renderedStage;
    let transitionStarted = performance.now();
    let zoom = 1;

    const applyTheme = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      displays.forEach((display) => {
        display.surface.material.uniforms.colorA.value.set(dark ? 0xaaa397 : 0xeee8dc);
        display.surface.material.uniforms.colorB.value.set(dark ? 0x5f8197 : 0x9fb5c8);
        display.surface.material.uniforms.lineTint.value.set(dark ? 0xd8e4e9 : 0x123f69);
        display.surface.material.uniforms.checkerStrength.value = dark ? 0.82 : 0.68;
        display.edges.material.color.set(dark ? 0xd5e4eb : 0x143f67);
        display.vertices.material.color.set(dark ? 0xf1746b : 0xed5b50);
        display.boundary.children.forEach((child) => {
          ((child as THREE.Line).material as THREE.LineBasicMaterial).color.set(dark ? 0x98b9cc : 0x718492);
        });
      });
    };
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const aspect = width / height;
      const vertical = 1.82;
      camera.left = -vertical * aspect;
      camera.right = vertical * aspect;
      camera.top = vertical;
      camera.bottom = -vertical;
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const canvas = renderer.domElement;
    canvas.setAttribute("aria-label", "Four related metric views of one abstract triangulation. Drag to orbit, use the wheel to zoom, or use the arrow and plus or minus keys.");
    canvas.setAttribute("role", "img");
    canvas.tabIndex = 0;
    let dragging = false;
    let previous = { x: 0, y: 0 };

    const onDown = (event: PointerEvent) => {
      dragging = true;
      previous = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      root.rotation.y += dx * 0.008;
      root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + dy * 0.006, -1.05, 0.95);
      previous = { x: event.clientX, y: event.clientY };
    };
    const onUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom = THREE.MathUtils.clamp(zoom * Math.exp(-event.deltaY * 0.001), 0.78, 1.65);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const rotationStep = 0.08;
      if (event.key === "ArrowLeft") root.rotation.y -= rotationStep;
      else if (event.key === "ArrowRight") root.rotation.y += rotationStep;
      else if (event.key === "ArrowUp") root.rotation.x = THREE.MathUtils.clamp(root.rotation.x - rotationStep, -1.05, 0.95);
      else if (event.key === "ArrowDown") root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + rotationStep, -1.05, 0.95);
      else if (event.key === "+" || event.key === "=") zoom = THREE.MathUtils.clamp(zoom * 1.08, 0.78, 1.65);
      else if (event.key === "-" || event.key === "_") zoom = THREE.MathUtils.clamp(zoom / 1.08, 0.78, 1.65);
      else return;
      event.preventDefault();
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      if (renderedStage !== stageRef.current) {
        previousStage = renderedStage;
        renderedStage = stageRef.current;
        activeDisplay = 1 - activeDisplay;
        transitionStarted = time;
        updateDisplay(displays[activeDisplay], renderedStage, renderedStage === "conformal" ? 0 : 1);
        setDisplayOpacity(displays[activeDisplay], 0);
      }

      const transition = reducedMotion
        ? 1
        : THREE.MathUtils.clamp((time - transitionStarted) / 560, 0, 1);
      if (reducedMotion) {
        setDisplayOpacity(displays[activeDisplay], 1);
        setDisplayOpacity(displays[1 - activeDisplay], 0);
      } else if (transition < 0.47) {
        const fadeOut = 1 - THREE.MathUtils.smootherstep(transition / 0.47, 0, 1);
        setDisplayOpacity(displays[activeDisplay], 0);
        setDisplayOpacity(displays[1 - activeDisplay], fadeOut);
      } else if (transition < 0.53) {
        setDisplayOpacity(displays[activeDisplay], 0);
        setDisplayOpacity(displays[1 - activeDisplay], 0);
      } else {
        const fadeIn = THREE.MathUtils.smootherstep((transition - 0.53) / 0.47, 0, 1);
        setDisplayOpacity(displays[activeDisplay], fadeIn);
        setDisplayOpacity(displays[1 - activeDisplay], 0);
      }

      if (renderedStage === "conformal") {
        const elapsed = Math.max(0, time - enteredAtRef.current);
        const progress = THREE.MathUtils.smootherstep(Math.min(1, elapsed / 3900), 0, 1);
        updateDisplay(displays[activeDisplay], "conformal", progress);
      }
      if (previousStage === "conformal" && transition < 1) {
        updateDisplay(displays[1 - activeDisplay], "conformal", 1);
      }

      if (!dragging && !reducedMotion) root.rotation.y += 0.001;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKeyDown);
      displays.forEach(disposeDisplay);
      renderer.dispose();
      renderer.domElement.remove();
      delete mount.dataset.webglReady;
    };
  }, []);

  const active = STAGES.find((item) => item.id === stage) ?? STAGES[0];

  return (
    <section className="metric-gallery" aria-label="Metric structure gallery">
      <div className="metric-stage">
        <div className="metric-topline">
          <span>{active.kind}</span>
          <span>{active.equation}</span>
        </div>
        <div ref={mountRef} className="metric-canvas">
          <MetricFallbackArt stage={stage} />
        </div>
        <div className="metric-hint">
          <span>DRAG · ORBIT</span>
          <span>WHEEL · ZOOM</span>
        </div>
      </div>

      <div className="metric-control">
        <span>ONE CONFORMAL CLASS</span>
        <strong>{active.name}</strong>
        <button type="button" onClick={replay} aria-label="Replay the four metric views">REPLAY ↻</button>
      </div>

      <div className="metric-index" aria-label="Choose a geometric view">
        {STAGES.map((item) => (
          <button
            key={item.id}
            className={stage === item.id ? "active" : ""}
            aria-pressed={stage === item.id}
            onClick={() => selectStage(item.id)}
          >
            <span>{item.number}</span>
            <strong>{item.shortName}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
