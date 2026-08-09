"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

const TAU = Math.PI * 2;
const NU = 48;
const NV = 24;
const LAST_STAGE = 3;
const PLAYBACK_STAGE_DURATION = 1800;
const PLAYBACK_END_HOLD = 720;

const stages = [
  { n: "01", at: 0, title: "Rectangle", note: "the quotient begins with a flat domain" },
  { n: "02", at: 1, title: "Cylinder", note: "one pair of opposite edges is joined" },
  { n: "03", at: 2, title: "Reversed identification", note: "the two boundary circles are matched in reverse" },
  { n: "04", at: 3, title: "Klein bottle", note: "the reversed boundary circles are joined to close the surface" },
] as const;

type Face = {
  points: Vec3[];
  depth: number;
  parity: number;
  kind: "surface" | "wrap" | "reverse";
};

type Vec3 = { x: number; y: number; z: number };

const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => vec3(
  a.x + (b.x - a.x) * t,
  a.y + (b.y - a.y) * t,
  a.z + (b.z - a.z) * t,
);
const subtract = (a: Vec3, b: Vec3): Vec3 => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
const cross = (a: Vec3, b: Vec3): Vec3 => vec3(
  a.y * b.z - a.z * b.y,
  a.z * b.x - a.x * b.z,
  a.x * b.y - a.y * b.x,
);
const normalize = (value: Vec3): Vec3 => {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return vec3(value.x / length, value.y / length, value.z / length);
};
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

function mod(value: number, base: number) {
  return ((value % base) + base) % base;
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function smootherstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function flatRectangle(u: number, v: number) {
  return vec3(
    (u / TAU - 0.5) * 5.8,
    (v / TAU - 0.5) * 3.45,
    0,
  );
}

// A developable rolling: at t=1 the upper and lower edges coincide.
function rolledRectangle(u: number, v: number, t: number) {
  if (t < 0.001) return flatRectangle(u, v);
  const q = v / TAU - 0.5;
  const width = 3.45;
  const angle = TAU * t * q;
  const radius = width / (TAU * t);
  const edgeLift = radius * (1 - Math.cos(Math.PI * t));
  return vec3(
    (u / TAU - 0.5) * 5.8,
    radius * Math.sin(angle),
    radius * (1 - Math.cos(angle)) - edgeLift,
  );
}

function bentCylinder(u: number, v: number, gap: number) {
  const s = u / TAU;
  const theta = -Math.PI + gap * 0.5 + (TAU - gap) * s;
  const radius = 2.34;
  const tube = 0.58;
  const nx = Math.cos(theta);
  const ny = Math.sin(theta);
  return vec3(
    radius * nx + tube * Math.cos(v) * nx,
    radius * ny + tube * Math.cos(v) * ny,
    tube * Math.sin(v),
  );
}

// Classical self-penetrating bottle immersion used by Three.js.
// Its end circles are identified by v ↦ π - v, an orientation reversal.
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

  return vec3(
    (x + 0.83) * 0.38,
    -(z + 1.02) * 0.27,
    y * 0.43,
  );
}

function positionAt(u: number, v: number, timeline: number) {
  if (timeline <= 1) return rolledRectangle(u, v, smoothstep(timeline));
  if (timeline <= 2) {
    const t = smoothstep(timeline - 1);
    return lerpVec(rolledRectangle(u, v, 1), bentCylinder(u, v, 1.16), t);
  }
  const t = smoothstep(timeline - 2);
  return lerpVec(bentCylinder(u, v, 1.16), kleinBottle(u, v), t);
}

function currentStage(timeline: number) {
  return clamp(Math.round(timeline), 0, LAST_STAGE);
}

function rotatePoint(point: Vec3, yaw: number, pitch: number) {
  const x1 = Math.cos(yaw) * point.x + Math.sin(yaw) * point.z;
  const z1 = -Math.sin(yaw) * point.x + Math.cos(yaw) * point.z;
  return vec3(
    x1,
    Math.cos(pitch) * point.y - Math.sin(pitch) * z1,
    Math.sin(pitch) * point.y + Math.cos(pitch) * z1,
  );
}

function collectFaces(timeline: number, yaw: number, pitch: number) {
  const point = (i: number, j: number) => rotatePoint(
    positionAt((mod(i, NU) / NU) * TAU, (mod(j, NV) / NV) * TAU, timeline),
    yaw,
    pitch,
  );
  const faces: Face[] = [];
  const pushFace = (indices: Array<[number, number]>, parity: number, kind: Face["kind"]) => {
    const points = indices.map(([i, j]) => point(i, j));
    faces.push({ points, depth: points.reduce((sum, p) => sum + p.z, 0) / points.length, parity, kind });
  };

  for (let i = 0; i < NU - 1; i += 1) {
    for (let j = 0; j < NV - 1; j += 1) {
      pushFace([[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], Math.floor(i / 4) + Math.floor(j / 3), "surface");
    }
  }

  if (timeline > 0.66) {
    for (let i = 0; i < NU - 1; i += 1) {
      pushFace([[i, NV - 1], [i + 1, NV - 1], [i + 1, 0], [i, 0]], Math.floor(i / 4), "wrap");
    }
  }

  if (timeline > 2.58) {
    for (let j = 0; j < NV; j += 1) {
      const j1 = (j + 1) % NV;
      pushFace([
        [NU - 1, j],
        [0, mod(NV / 2 - j, NV)],
        [0, mod(NV / 2 - j1, NV)],
        [NU - 1, j1],
      ], 0, "reverse");
    }
  }

  return faces.sort((a, b) => a.depth - b.depth);
}

function drawScene(
  canvas: HTMLCanvasElement,
  timeline: number,
  checker: boolean,
  xray: boolean,
  yaw: number,
  pitch: number,
  zoom: number,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const scale = Math.min(width * 0.13, height * 0.17) * zoom;
  const centerX = width * 0.5;
  const centerY = height * 0.5 + 6;
  const project = (point: Vec3) => {
    const perspective = 9.4 / (9.4 - point.z);
    return { x: centerX + point.x * scale * perspective, y: centerY - point.y * scale * perspective };
  };

  const wrapAlpha = smoothstep((timeline - 0.68) / 0.28);
  const reverseAlpha = smoothstep((timeline - 2.62) / 0.3);
  const light = normalize(vec3(0.35, 0.7, 0.62));

  for (const face of collectFaces(timeline, yaw, pitch)) {
    const a = face.points[0];
    const b = face.points[1];
    const d = face.points[3];
    const normal = normalize(cross(subtract(b, a), subtract(d, a)));
    const shade = 0.78 + 0.22 * Math.abs(dot(normal, light));
    let base = checker && face.parity % 2 ? [139, 159, 174] : [222, 213, 194];
    let alpha = xray ? 0.64 : 0.98;
    if (face.kind === "wrap") alpha *= wrapAlpha;
    if (face.kind === "reverse") {
      base = [239, 98, 90];
      alpha = reverseAlpha * 0.9;
    }
    const points = face.points.map(project);
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
    context.closePath();
    context.fillStyle = `rgba(${Math.round(base[0] * shade)}, ${Math.round(base[1] * shade)}, ${Math.round(base[2] * shade)}, ${alpha})`;
    context.fill();
    context.strokeStyle = face.kind === "reverse"
      ? `rgba(153,50,48,${reverseAlpha * 0.78})`
      : `rgba(23,59,90,${xray ? 0.52 : 0.34})`;
    context.lineWidth = 0.62;
    context.lineJoin = "round";
    context.stroke();
  }
}

function ArrowGlyph({ direction }: { direction: "left" | "right" | "up" }) {
  const path = direction === "left"
    ? "M17 5H4m0 0 4-4M4 5l4 4"
    : direction === "right"
      ? "M3 5h13m0 0-4-4m4 4-4 4"
      : "M5 17V4m0 0L1 8m4-4 4 4";
  return <svg viewBox="0 0 20 18" aria-hidden="true"><path d={path} /></svg>;
}

export default function KleinDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef(0);
  const checkerRef = useRef(true);
  const xrayRef = useRef(false);
  const cameraRef = useRef({ yaw: 0.34, pitch: -0.22, zoom: 1 });
  const dirtyRef = useRef(true);
  const tweenRef = useRef<number | null>(null);
  const settleRef = useRef<number | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const playbackIdRef = useRef(0);
  const dragRef = useRef({
    mode: null as "timeline" | "rotate" | null,
    startX: 0,
    startY: 0,
    startTimeline: 0,
    startYaw: 0,
    startPitch: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
  });
  const [timeline, setTimelineState] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [checker, setCheckerState] = useState(true);
  const [xray, setXrayState] = useState(false);
  const [playing, setPlaying] = useState(false);

  const setTimeline = useCallback((next: number) => {
    const value = clamp(next, 0, LAST_STAGE);
    timelineRef.current = value;
    dirtyRef.current = true;
    setTimelineState(value);
  }, []);

  const setChecker = (next: boolean) => {
    checkerRef.current = next;
    dirtyRef.current = true;
    setCheckerState(next);
  };

  const setXray = (next: boolean) => {
    xrayRef.current = next;
    dirtyRef.current = true;
    setXrayState(next);
  };

  const animateTo = useCallback((
    target: number,
    durationOverride?: number,
    onComplete?: () => void,
  ) => {
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
    const from = timelineRef.current;
    const destination = clamp(target, 0, LAST_STAGE);
    const distance = Math.abs(destination - from);
    if (distance < 0.001) {
      setTimeline(destination);
      onComplete?.();
      return;
    }
    const started = performance.now();
    const duration = durationOverride ?? 360 + distance * 150;
    const tick = (now: number) => {
      const t = clamp((now - started) / duration, 0, 1);
      const eased = durationOverride === undefined ? 1 - Math.pow(1 - t, 3) : smootherstep(t);
      setTimeline(from + (destination - from) * eased);
      if (t < 1) tweenRef.current = requestAnimationFrame(tick);
      else {
        tweenRef.current = null;
        onComplete?.();
      }
    };
    tweenRef.current = requestAnimationFrame(tick);
  }, [setTimeline]);

  const stopPlayback = useCallback(() => {
    playbackIdRef.current += 1;
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
    if (loopTimerRef.current !== null) window.clearTimeout(loopTimerRef.current);
    tweenRef.current = null;
    loopTimerRef.current = null;
    setPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    stopPlayback();
    const playbackId = playbackIdRef.current;
    setTimeline(0);
    setPlaying(true);

    const travel = (target: number, direction: 1 | -1) => {
      if (playbackIdRef.current !== playbackId) return;
      animateTo(target, PLAYBACK_STAGE_DURATION, () => {
        if (playbackIdRef.current !== playbackId) return;
        if (target === LAST_STAGE) {
          loopTimerRef.current = window.setTimeout(
            () => travel(LAST_STAGE - 1, -1),
            PLAYBACK_END_HOLD,
          );
        } else if (target === 0) {
          loopTimerRef.current = window.setTimeout(
            () => travel(1, 1),
            PLAYBACK_END_HOLD,
          );
        } else {
          travel(target + direction, direction);
        }
      });
    };

    loopTimerRef.current = window.setTimeout(() => travel(1, 1), 520);
  }, [animateTo, setTimeline, stopPlayback]);

  useEffect(() => {
    const startupTimer = window.setTimeout(startPlayback, 120);
    return () => {
      playbackIdRef.current += 1;
      window.clearTimeout(startupTimer);
      if (loopTimerRef.current !== null) window.clearTimeout(loopTimerRef.current);
    };
  }, [startPlayback]);

  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => { dirtyRef.current = true; });
    if (canvasRef.current) observer.observe(canvasRef.current);
    const render = () => {
      if (dirtyRef.current && canvasRef.current) {
        drawScene(
          canvasRef.current,
          timelineRef.current,
          checkerRef.current,
          xrayRef.current,
          cameraRef.current.yaw,
          cameraRef.current.pitch,
          cameraRef.current.zoom,
        );
        dirtyRef.current = false;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
      if (settleRef.current !== null) window.clearTimeout(settleRef.current);
      if (loopTimerRef.current !== null) window.clearTimeout(loopTimerRef.current);
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 2) return;
    stopPlayback();
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.button === 2) {
      event.preventDefault();
      dragRef.current = {
        mode: "rotate",
        startX: event.clientX,
        startY: event.clientY,
        startTimeline: timelineRef.current,
        startYaw: cameraRef.current.yaw,
        startPitch: cameraRef.current.pitch,
        lastX: event.clientX,
        lastTime: performance.now(),
        velocity: 0,
      };
      setRotating(true);
      return;
    }
    dragRef.current = {
      mode: "timeline",
      startX: event.clientX,
      startY: event.clientY,
      startTimeline: timelineRef.current,
      startYaw: cameraRef.current.yaw,
      startPitch: cameraRef.current.pitch,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
    };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.mode) return;
    if (drag.mode === "rotate") {
      cameraRef.current.yaw = mod(
        drag.startYaw + (event.clientX - drag.startX) * 0.009 + Math.PI,
        TAU,
      ) - Math.PI;
      cameraRef.current.pitch = mod(
        drag.startPitch + (event.clientY - drag.startY) * 0.009 + Math.PI,
        TAU,
      ) - Math.PI;
      dirtyRef.current = true;
      return;
    }
    const now = performance.now();
    const elapsed = Math.max(now - drag.lastTime, 8);
    const widthPerStage = Math.min(240, Math.max(135, event.currentTarget.clientWidth * 0.24));
    setTimeline(drag.startTimeline + (event.clientX - drag.startX) / widthPerStage);
    drag.velocity = ((event.clientX - drag.lastX) / widthPerStage) / (elapsed / 1000);
    drag.lastX = event.clientX;
    drag.lastTime = now;
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      if (dragRef.current.mode !== "timeline") return;
      dragRef.current.mode = null;
      setDragging(false);
      animateTo(Math.round(timelineRef.current + clamp(dragRef.current.velocity * 0.08, -0.42, 0.42)));
    }, 1200);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.mode) return;
    const mode = drag.mode;
    drag.mode = null;
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (mode === "rotate") {
      setRotating(false);
      return;
    }
    setDragging(false);
    animateTo(Math.round(timelineRef.current + clamp(drag.velocity * 0.08, -0.42, 0.42)));
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    stopPlayback();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? event.currentTarget.clientHeight : 1;
    const delta = clamp(event.deltaY * unit, -180, 180);
    cameraRef.current.zoom = clamp(
      cameraRef.current.zoom * Math.exp(-delta * 0.0015),
      0.58,
      1.85,
    );
    dirtyRef.current = true;
  };

  const stage = currentStage(timeline);
  const timelinePercent = (timeline / LAST_STAGE) * 100;

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="home-mark" href="/">TO SEE CLEARLY.</a>
        <span className="play-mark">PLAY / 01</span>
        <a
          className="back-link"
          href="/#play"
          onClick={(event) => {
            if (document.referrer && window.history.length > 1) {
              event.preventDefault();
              window.history.back();
            }
          }}
        >← BACK TO PLAY</a>
      </header>

      <section className="intro">
        <div className="intro-title">
          <h1>Klein Bottle</h1>
          <p>shown through its classical immersion in R³</p>
        </div>
        <div className="formula" aria-label="x zero is identified with one minus x one">(x, 0) <span>∼</span> (1−x, 1)</div>
      </section>

      <section className="demo-card" aria-label="Interactive Klein bottle construction">
        <div className="paper-grain" />
        <div className="diagram-corner" aria-hidden="true">
          <div className="mini-rect">
            <span className="edge top"><ArrowGlyph direction="left" /></span>
            <span className="edge bottom"><ArrowGlyph direction="right" /></span>
            <span className="edge left"><ArrowGlyph direction="up" /></span>
            <span className="edge right"><ArrowGlyph direction="up" /></span>
          </div>
          <span>one return is reversed</span>
        </div>

        <div className="stage-readout">
          <span>{stages[stage].n}</span>
          <strong>{stages[stage].title}</strong>
          <small>{stages[stage].note}</small>
        </div>

        <canvas ref={canvasRef} className="canvas-mount" aria-hidden="true" />
        <div
          className={`drag-surface${dragging ? " dragging" : ""}${rotating ? " rotating" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
          onWheel={onWheel}
          onContextMenu={(event) => event.preventDefault()}
          role="slider"
          aria-label="Klein bottle construction timeline"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={stage}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              stopPlayback();
              animateTo(stage + 1);
            }
            if (event.key === "ArrowLeft") {
              stopPlayback();
              animateTo(stage - 1);
            }
          }}
        >
          <div className="drag-cue" aria-hidden="true"><span>← undo</span><i /><span>construct →</span></div>
          <div className="rotate-cue" aria-hidden="true">right-drag orbit · wheel zoom</div>
        </div>

        {timeline > 1.7 && timeline < 2.85 && <div className="seam-note" aria-hidden="true"><span className="scribble-arrow">↝</span>match in reverse</div>}

        <div className="controls">
          <div className="timeline-rule" aria-hidden="true"><span style={{ width: `${timelinePercent}%` }} /></div>
          <div className="stage-tabs">
            {stages.map((item, index) => (
              <button
                key={item.n}
                className={stage === index ? "active" : ""}
                onClick={() => {
                  stopPlayback();
                  animateTo(item.at);
                }}
              >
                <span>{item.n}</span><strong>{item.title}</strong>
              </button>
            ))}
          </div>
          <button className="replay-button" onClick={startPlayback} aria-pressed={playing}>REPLAY</button>
          <button className="xray-button" onClick={() => { stopPlayback(); setXray(!xray); }} aria-pressed={xray}>X-RAY {xray ? "ON" : "OFF"}</button>
          <button className="checker-button" onClick={() => { stopPlayback(); setChecker(!checker); }} aria-pressed={checker}>CHECKER {checker ? "ON" : "OFF"}</button>
        </div>
      </section>

      <p className="construction-note">At the last step, the two open ends are joined in opposite directions. In ordinary 3D space, the surface must pass through itself to make this connection.</p>

      <footer className="site-footer">
        <span>LEI WANG</span>
        <span>TO SEE CLEARLY.</span>
        <span>© {new Date().getFullYear()} LEI WANG. ALL RIGHTS RESERVED.</span>
      </footer>
    </main>
  );
}
