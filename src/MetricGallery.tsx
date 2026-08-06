"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

type MetricId = "euclidean" | "spherical" | "ideal" | "hyperbolic";

const METRICS: Array<{
  id: MetricId;
  number: string;
  shortName: string;
  name: string;
}> = [
  {
    id: "euclidean",
    number: "01",
    shortName: "Polyhedral",
    name: "Piecewise Euclidean",
  },
  {
    id: "spherical",
    number: "02",
    shortName: "Spherical",
    name: "Spherical",
  },
  {
    id: "ideal",
    number: "03",
    shortName: "Ideal H³",
    name: "Ideal Hyperbolic",
  },
  {
    id: "hyperbolic",
    number: "04",
    shortName: "Hyperbolic",
    name: "Hyperbolic Polyhedral · Poincaré Model",
  },
];

type Node = {
  reference: THREE.Vector3;
  targets: Record<MetricId, THREE.Vector3>;
};

type PolyhedronModel = {
  surface: THREE.BufferGeometry;
  surfaceNodes: Node[];
  boundary: THREE.BufferGeometry;
  boundaryNodes: Node[];
  interior: THREE.BufferGeometry;
  interiorNodes: Node[];
};

function irregularity(direction: THREE.Vector3) {
  return 0.94 + 0.11 * Math.sin(direction.x * 8.3 + direction.y * 4.7 - direction.z * 6.1);
}

const HYPERBOLIC_DISPLAY_SCALE = 2.4;

function hyperbolicKleinPoint(direction: THREE.Vector3) {
  const radius = 0.64 + 0.18 * (0.5 + 0.5 * Math.sin(5.7 * direction.x - 3.9 * direction.y + 4.8 * direction.z));
  return direction.clone().multiplyScalar(radius);
}

function kleinToPoincare(point: THREE.Vector3) {
  const radiusSquared = Math.min(point.lengthSq(), 1 - 1e-7);
  return point
    .clone()
    .multiplyScalar(HYPERBOLIC_DISPLAY_SCALE / (1 + Math.sqrt(1 - radiusSquared)));
}

function referenceCorner(direction: THREE.Vector3) {
  const point = direction.clone().multiplyScalar(1.33);
  point.x *= 1.04;
  point.y *= 0.94;
  return point;
}

function cornerNode(direction: THREE.Vector3): Node {
  const reference = referenceCorner(direction);
  const euclidean = reference.clone().multiplyScalar(irregularity(direction));
  const spherical = direction.clone().multiplyScalar(1.38);
  const ideal = direction.clone().multiplyScalar(1.57);
  const hyperbolic = kleinToPoincare(hyperbolicKleinPoint(direction));
  return {
    reference,
    targets: { euclidean, spherical, ideal, hyperbolic },
  };
}

function centerNode(corners: Node[], directions: THREE.Vector3[]): Node {
  const average = (points: THREE.Vector3[]) =>
    points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
  const meanDirection = average(directions).normalize();
  const hyperbolicFaceCenter = kleinToPoincare(average(directions.map(hyperbolicKleinPoint)));
  return {
    reference: average(corners.map((corner) => corner.reference)),
    targets: {
      euclidean: average(corners.map((corner) => corner.targets.euclidean)),
      spherical: meanDirection.clone().multiplyScalar(1.38),
      ideal: meanDirection.clone().multiplyScalar(0.78),
      hyperbolic: hyperbolicFaceCenter,
    },
  };
}

function geometryFromNodes(nodes: Node[]) {
  const positions = new Float32Array(nodes.length * 3);
  nodes.forEach((node, index) => node.reference.toArray(positions, index * 3));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createPolyhedronModel(): PolyhedronModel {
  const sourceGeometry = new THREE.IcosahedronGeometry(1, 0);
  const source = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry;
  const positions = source.getAttribute("position") as THREE.BufferAttribute;
  const surfaceNodes: Node[] = [];
  const boundaryNodes: Node[] = [];
  const interiorNodes: Node[] = [];

  for (let face = 0; face < positions.count; face += 3) {
    const directions = [0, 1, 2].map((offset) =>
      new THREE.Vector3().fromBufferAttribute(positions, face + offset).normalize(),
    );
    const corners = directions.map(cornerNode);
    const center = centerNode(corners, directions);

    for (let side = 0; side < 3; side += 1) {
      const a = corners[side];
      const b = corners[(side + 1) % 3];
      surfaceNodes.push(a, b, center);
      boundaryNodes.push(a, b);
      interiorNodes.push(a, center);
    }
  }

  sourceGeometry.dispose();
  if (source !== sourceGeometry) source.dispose();

  return {
    surface: geometryFromNodes(surfaceNodes),
    surfaceNodes,
    boundary: geometryFromNodes(boundaryNodes),
    boundaryNodes,
    interior: geometryFromNodes(interiorNodes),
    interiorNodes,
  };
}

function updateGeometry(
  geometry: THREE.BufferGeometry,
  nodes: Node[],
  metric: MetricId,
  amount: number,
  smoothing: number,
) {
  const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
  const array = attribute.array as Float32Array;
  nodes.forEach((node, index) => {
    const target = node.targets[metric];
    const x = THREE.MathUtils.lerp(node.reference.x, target.x, amount);
    const y = THREE.MathUtils.lerp(node.reference.y, target.y, amount);
    const z = THREE.MathUtils.lerp(node.reference.z, target.z, amount);
    array[index * 3] = THREE.MathUtils.lerp(array[index * 3], x, smoothing);
    array[index * 3 + 1] = THREE.MathUtils.lerp(array[index * 3 + 1], y, smoothing);
    array[index * 3 + 2] = THREE.MathUtils.lerp(array[index * 3 + 2], z, smoothing);
  });
  attribute.needsUpdate = true;
}

export default function MetricGallery() {
  const mountRef = useRef<HTMLDivElement>(null);
  const metricRef = useRef<MetricId>("euclidean");
  const amountRef = useRef(1);
  const [metric, setMetric] = useState<MetricId>("euclidean");
  const [amount, setAmount] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);

  const selectMetric = useCallback((next: MetricId, manual = true) => {
    const nextAmount = next === "euclidean" ? 1 : next === "ideal" ? 0.82 : 0.72;
    metricRef.current = next;
    amountRef.current = nextAmount;
    setMetric(next);
    setAmount(nextAmount);
    if (manual) setIsPlaying(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = METRICS[Math.floor(Math.random() * METRICS.length)].id;
      const nextAmount = next === "euclidean" ? 0.82 + Math.random() * 0.18 : 0.58 + Math.random() * 0.3;
      metricRef.current = next;
      amountRef.current = nextAmount;
      setMetric(next);
      setAmount(nextAmount);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      const index = METRICS.findIndex((item) => item.id === metricRef.current);
      selectMetric(METRICS[(index + 1) % METRICS.length].id, false);
    }, 4400);
    return () => window.clearInterval(timer);
  }, [isPlaying, selectMetric]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.set(0.3, 2.3, 5.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const model = createPolyhedronModel();
    const surfaceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        colorA: { value: new THREE.Color(0xefeae0) },
        colorB: { value: new THREE.Color(0xb7c6d6) },
        lightDirection: { value: new THREE.Vector3(-0.45, 0.8, 0.55).normalize() },
        ambientLight: { value: 0.76 },
        diffuseLight: { value: 0.32 },
        checkerMix: { value: 0.58 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 colorA;
        uniform vec3 colorB;
        uniform vec3 lightDirection;
        uniform float ambientLight;
        uniform float diffuseLight;
        uniform float checkerMix;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float cells = mod(
            floor((vPosition.x + 2.0) * 2.55) +
            floor((vPosition.y + 2.0) * 2.55) +
            floor((vPosition.z + 2.0) * 2.55),
            2.0
          );
          vec3 base = mix(colorA, colorB, cells * checkerMix);
          float light = ambientLight + diffuseLight * max(dot(normalize(vNormal), lightDirection), 0.0);
          gl_FragColor = vec4(base * light, 1.0);
          #include <colorspace_fragment>
        }
      `,
      side: THREE.DoubleSide,
    });
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x123f69, transparent: true, opacity: 0.68 });
    const interiorMaterial = new THREE.LineBasicMaterial({ color: 0x123f69, transparent: true, opacity: 0.16 });

    const applyTheme = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      surfaceMaterial.uniforms.colorA.value.set(dark ? 0xa59f92 : 0xefeae0);
      surfaceMaterial.uniforms.colorB.value.set(dark ? 0x56788f : 0xb7c6d6);
      surfaceMaterial.uniforms.ambientLight.value = dark ? 0.84 : 0.76;
      surfaceMaterial.uniforms.diffuseLight.value = dark ? 0.26 : 0.32;
      surfaceMaterial.uniforms.checkerMix.value = dark ? 0.72 : 0.58;
      boundaryMaterial.color.set(dark ? 0xd6e3ea : 0x123f69);
      boundaryMaterial.opacity = dark ? 0.9 : 0.68;
      interiorMaterial.color.set(dark ? 0xa5bfce : 0x123f69);
      interiorMaterial.opacity = dark ? 0.38 : 0.16;
    };
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const group = new THREE.Group();
    group.rotation.set(-0.12, -0.38 + Math.random() * 0.44, 0.03);
    const surface = new THREE.Mesh(model.surface, surfaceMaterial);
    const boundary = new THREE.LineSegments(model.boundary, boundaryMaterial);
    const interior = new THREE.LineSegments(model.interior, interiorMaterial);
    group.add(surface, interior, boundary);
    scene.add(group);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const aspect = width / height;
      const vertical = 1.84;
      camera.left = -vertical * aspect;
      camera.right = vertical * aspect;
      camera.top = vertical;
      camera.bottom = -vertical;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let dragging = false;
    let moved = false;
    let previous = { x: 0, y: 0 };
    let renderedMetric = metricRef.current;
    let renderedAmount = amountRef.current;
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-label", "Interactive closed genus-zero polyhedron. Drag to orbit; click to change metric.");
    canvas.setAttribute("role", "img");
    canvas.tabIndex = 0;

    const onDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      previous = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      group.rotation.y += dx * 0.008;
      group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + dy * 0.006, -0.75, 0.65);
      previous = { x: event.clientX, y: event.clientY };
    };
    const onUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!moved) {
        const index = METRICS.findIndex((item) => item.id === metricRef.current);
        selectMetric(METRICS[(index + 1) % METRICS.length].id);
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const index = METRICS.findIndex((item) => item.id === metricRef.current);
      selectMetric(METRICS[(index + 1) % METRICS.length].id);
    };
    canvas.addEventListener("keydown", onKeyDown);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let idle = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (renderedMetric !== metricRef.current) renderedMetric = metricRef.current;
      renderedAmount = THREE.MathUtils.lerp(renderedAmount, amountRef.current, reducedMotion ? 1 : 0.075);
      const smoothing = reducedMotion ? 1 : 0.075;
      updateGeometry(model.surface, model.surfaceNodes, renderedMetric, renderedAmount, smoothing);
      updateGeometry(model.boundary, model.boundaryNodes, renderedMetric, renderedAmount, smoothing);
      updateGeometry(model.interior, model.interiorNodes, renderedMetric, renderedAmount, smoothing);
      model.surface.computeVertexNormals();
      if (!dragging && !reducedMotion) {
        idle += 1;
        group.rotation.y += 0.0011 + Math.sin(idle * 0.007) * 0.00025;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("keydown", onKeyDown);
      model.surface.dispose();
      model.boundary.dispose();
      model.interior.dispose();
      surfaceMaterial.dispose();
      boundaryMaterial.dispose();
      interiorMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [selectMetric]);

  const active = METRICS.find((item) => item.id === metric) ?? METRICS[0];

  return (
    <section className="metric-gallery" aria-label="Metric Gallery">
      <div className="metric-stage">
        <div ref={mountRef} className="metric-canvas" />
      </div>

      <div className="metric-control">
        <span>REFERENCE</span>
        <input
          aria-label={`${active.name} realization amount`}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={amount}
          onChange={(event) => {
            const value = Number(event.target.value);
            amountRef.current = value;
            setAmount(value);
            setIsPlaying(false);
          }}
        />
        <span>{active.shortName.toUpperCase()}</span>
      </div>

      <div className="metric-index" aria-label="Choose metric">
        {METRICS.map((item) => (
          <button key={item.id} className={metric === item.id ? "active" : ""} onClick={() => selectMetric(item.id)}>
            <span>{item.number}</span>
            <strong>{item.shortName}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
