"use client";

import { useEffect, useRef } from "react";

type Vec3 = { x: number; y: number; z: number };
type Face = { points: Vec3[]; depth: number; parity: number; reverse: boolean };

const TAU = Math.PI * 2;
const NU = 42;
const NV = 20;

const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const subtract = (a: Vec3, b: Vec3) => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
const cross = (a: Vec3, b: Vec3) => vec3(
  a.y * b.z - a.z * b.y,
  a.z * b.x - a.x * b.z,
  a.x * b.y - a.y * b.x,
);
const normalize = (value: Vec3) => {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return vec3(value.x / length, value.y / length, value.z / length);
};
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const mod = (value: number, base: number) => ((value % base) + base) % base;

// The same classical immersion used by the full Klein bottle demo.
function kleinBottle(u: number, v: number) {
  let x: number;
  let z: number;

  if (u < Math.PI) {
    x = 3 * Math.cos(u) * (1 + Math.sin(u))
      + 2 * (1 - Math.cos(u) / 2) * Math.cos(u) * Math.cos(v);
    z = -8 * Math.sin(u)
      - 2 * (1 - Math.cos(u) / 2) * Math.sin(u) * Math.cos(v);
  } else {
    x = 3 * Math.cos(u) * (1 + Math.sin(u))
      + 2 * (1 - Math.cos(u) / 2) * Math.cos(v + Math.PI);
    z = -8 * Math.sin(u);
  }

  const y = -2 * (1 - Math.cos(u) / 2) * Math.sin(v);
  return vec3((x + 0.83) * 0.38, -(z + 1.02) * 0.27, y * 0.43);
}

function rotate(point: Vec3, yaw: number, pitch: number) {
  const x1 = Math.cos(yaw) * point.x + Math.sin(yaw) * point.z;
  const z1 = -Math.sin(yaw) * point.x + Math.cos(yaw) * point.z;
  return vec3(
    x1,
    Math.cos(pitch) * point.y - Math.sin(pitch) * z1,
    Math.sin(pitch) * point.y + Math.cos(pitch) * z1,
  );
}

function collectFaces(yaw: number, pitch: number) {
  const point = (i: number, j: number) => rotate(
    kleinBottle((mod(i, NU) / NU) * TAU, (mod(j, NV) / NV) * TAU),
    yaw,
    pitch,
  );
  const faces: Face[] = [];
  const pushFace = (indices: Array<[number, number]>, parity: number, reverse = false) => {
    const points = indices.map(([i, j]) => point(i, j));
    faces.push({
      points,
      parity,
      reverse,
      depth: points.reduce((sum, p) => sum + p.z, 0) / points.length,
    });
  };

  for (let i = 0; i < NU - 1; i += 1) {
    for (let j = 0; j < NV - 1; j += 1) {
      pushFace(
        [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]],
        Math.floor(i / 4) + Math.floor(j / 3),
      );
    }
    pushFace(
      [[i, NV - 1], [i + 1, NV - 1], [i + 1, 0], [i, 0]],
      Math.floor(i / 4),
    );
  }

  for (let j = 0; j < NV; j += 1) {
    const j1 = (j + 1) % NV;
    pushFace(
      [[NU - 1, j], [0, mod(NV / 2 - j, NV)], [0, mod(NV / 2 - j1, NV)], [NU - 1, j1]],
      0,
      true,
    );
  }

  return faces.sort((a, b) => a.depth - b.depth);
}

export default function KleinBottlePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let frame = 0;
    let visible = true;
    let lastDraw = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const light = normalize(vec3(0.35, 0.7, 0.62));

    const draw = (time = 0) => {
      const dark = document.documentElement.dataset.theme === "dark";
      const yaw = 0.34 + (reduceMotion ? 0 : Math.sin(time * 0.00018) * 0.055);
      const pitch = -0.22;
      const scale = Math.min(width * 0.128, height * 0.19);
      const centerX = width * 0.5;
      const centerY = height * 0.51;
      const project = (point: Vec3) => {
        const perspective = 9.4 / (9.4 - point.z);
        return { x: centerX + point.x * scale * perspective, y: centerY - point.y * scale * perspective };
      };

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      for (const face of collectFaces(yaw, pitch)) {
        const normal = normalize(cross(subtract(face.points[1], face.points[0]), subtract(face.points[3], face.points[0])));
        const shade = 0.78 + 0.22 * Math.abs(dot(normal, light));
        const base = face.reverse
          ? [239, 98, 90]
          : face.parity % 2
            ? (dark ? [93, 122, 139] : [139, 159, 174])
            : (dark ? [173, 166, 151] : [222, 213, 194]);
        const points = face.points.map(project);
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y);
        context.closePath();
        context.fillStyle = `rgb(${Math.round(base[0] * shade)}, ${Math.round(base[1] * shade)}, ${Math.round(base[2] * shade)})`;
        context.fill();
        context.strokeStyle = face.reverse
          ? (dark ? "rgba(241,116,107,.82)" : "rgba(153,50,48,.7)")
          : (dark ? "rgba(203,221,232,.32)" : "rgba(23,59,90,.28)");
        context.lineWidth = 0.62;
        context.lineJoin = "round";
        context.stroke();
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      draw(performance.now());
    };

    const animate = (time: number) => {
      if (visible && !reduceMotion && time - lastDraw > 75) {
        draw(time);
        lastDraw = time;
      }
      frame = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: "120px" });
    intersectionObserver.observe(canvas);
    const themeObserver = new MutationObserver(() => draw(performance.now()));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    resize();
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="klein-preview" aria-hidden="true" />;
}
