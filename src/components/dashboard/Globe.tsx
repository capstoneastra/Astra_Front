import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { landOutlines } from "../../data/globeLand";

const RAD = Math.PI / 180;
function inside(x, y, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      result = !result;
  }
  return result;
}
const landPoints = [];
for (let lat = -55; lat < 80; lat += 2.1) {
  for (
    let lon = -180;
    lon < 180;
    lon += 2.1 / Math.max(0.3, Math.cos(lat * RAD))
  ) {
    if (landOutlines.some((polygon) => inside(lon, lat, polygon)))
      landPoints.push([lat, lon]);
  }
}

export default function Globe({ showExampleLocation }) {
  const canvas = useRef(null);
  const longitude = useRef(106);
  const redraw = useRef(null);
  const [paused, setPaused] = useState(true);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element.getContext("2d");
    if (!ctx) {
      setAvailable(false);
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame;
    let last = 0;
    let previousTime = 0;
    let visible = true;
    const project = (lat, lon) => {
      const phi = lat * RAD;
      const lambda = (lon - longitude.current) * RAD;
      const tilt = 22 * RAD;
      return [
        Math.cos(phi) * Math.sin(lambda),
        Math.cos(tilt) * Math.sin(phi) -
          Math.sin(tilt) * Math.cos(phi) * Math.cos(lambda),
        Math.sin(tilt) * Math.sin(phi) +
          Math.cos(tilt) * Math.cos(phi) * Math.cos(lambda),
      ];
    };
    const draw = () => {
      if (!width || !height) return;
      const cx = width * 0.55;
      const cy = height * 0.54;
      const radius = Math.min(width * 0.36, height * 0.465);
      ctx.clearRect(0, 0, width, height);
      // Deterministic stars keep the visualization stable between renders.
      for (let i = 0; i < 52; i++) {
        const x = (i * 137.508 + 43) % width;
        const y = (i * 67.31 + 27) % height;
        ctx.fillStyle = `rgba(151,190,224,${i % 4 === 0 ? 0.4 : 0.13})`;
        ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
      }
      const halo = ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.8,
        cx,
        cy,
        radius * 1.36,
      );
      halo.addColorStop(0, "rgba(31,139,190,0)");
      halo.addColorStop(0.52, "rgba(37,151,211,0.13)");
      halo.addColorStop(1, "rgba(31,139,190,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.36, 0, Math.PI * 2);
      ctx.fill();
      const ocean = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.4,
        0,
        cx,
        cy,
        radius,
      );
      ocean.addColorStop(0, "#163d53");
      ocean.addColorStop(0.58, "#0b263b");
      ocean.addColorStop(1, "#081628");
      ctx.fillStyle = ocean;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      const line = (coords) => {
        let connected = false;
        ctx.beginPath();
        for (const [lat, lon] of coords) {
          const [x, y, z] = project(lat, lon);
          if (z < 0) {
            connected = false;
            continue;
          }
          if (connected) ctx.lineTo(cx + x * radius, cy - y * radius);
          else ctx.moveTo(cx + x * radius, cy - y * radius);
          connected = true;
        }
        ctx.stroke();
      };
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(103,180,207,0.16)";
      for (let lat = -60; lat <= 60; lat += 20)
        line(Array.from({ length: 181 }, (_, i) => [lat, i * 2 - 180]));
      for (let lon = -180; lon < 180; lon += 20)
        line(Array.from({ length: 91 }, (_, i) => [i * 2 - 90, lon]));
      for (const [lat, lon] of landPoints) {
        const [x, y, z] = project(lat, lon);
        if (z <= 0) continue;
        ctx.fillStyle = `rgba(${90 + Math.round(z * 41)},${160 + Math.round(z * 47)},${179 + Math.round(z * 42)},${0.28 + z * 0.58})`;
        ctx.beginPath();
        ctx.arc(
          cx + x * radius,
          cy - y * radius,
          Math.max(0.65, radius * 0.0055 * (0.6 + z * 0.4)),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(109,201,234,0.34)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.32);
      ctx.strokeStyle = "rgba(76,180,216,0.2)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.22, radius * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (showExampleLocation) {
        const [x, y, z] = project(35.18, 128.1);
        if (z > 0) {
          const px = cx + x * radius;
          const py = cy - y * radius;
          const glow = ctx.createRadialGradient(px, py, 1, px, py, 28);
          glow.addColorStop(0, "rgba(70,223,238,0.5)");
          glow.addColorStop(1, "rgba(70,223,238,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, 28, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(113,233,247,0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(px, py, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#b5faff";
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(px + 12, py - 3);
          ctx.lineTo(px + 36, py - 22);
          ctx.lineTo(px + 77, py - 22);
          ctx.stroke();
          ctx.fillStyle = "#a3d9e5";
          ctx.font = "10px sans-serif";
          ctx.fillText("JINJU · DEMO", px + 38, py - 29);
        }
      }
    };
    redraw.current = draw;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    const animate = (now) => {
      frame = requestAnimationFrame(animate);
      if (!previousTime) previousTime = now;
      const elapsed = Math.min(now - previousTime, 100);
      previousTime = now;
      if (
        !visible ||
        document.hidden ||
        paused ||
        reduceMotion.matches ||
        now - last < 40
      )
        return;
      longitude.current += elapsed * 0.002;
      last = now;
      draw();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    intersection.observe(element);
    resize();
    frame = requestAnimationFrame(animate);
    reduceMotion.addEventListener("change", draw);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      reduceMotion.removeEventListener("change", draw);
      redraw.current = null;
    };
  }, [paused, showExampleLocation]);

  const rotate = (amount) => {
    longitude.current += amount;
    redraw.current?.();
  };
  return (
    <div className="globe">
      <div className="globe__coordinate" aria-hidden="true">
        <span>ORBITAL VIEW</span>
        <span>35° N / 128° E · 예시</span>
      </div>
      <canvas ref={canvas} className="globe__canvas" aria-hidden="true" />
      {!available && (
        <div className="globe__fallback">
          <span />
          시각화를 표시할 수 없습니다. 기관 목록에서 정보를 확인하세요.
        </div>
      )}
      <div className="globe__caption">
        <span className="status-dot" />
        대한민국 중심 · 개략 시각화
      </div>
      <div className="globe__controls">
        <button
          className="icon-button"
          aria-label="지구본 왼쪽 회전"
          onClick={() => rotate(-20)}
        >
          <RotateCcw size={15} />
        </button>
        <button
          className="icon-button"
          aria-label={
            paused ? "지구본 자동 회전 시작" : "지구본 자동 회전 정지"
          }
          aria-pressed={!paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button
          className="icon-button"
          aria-label="지구본 오른쪽 회전"
          onClick={() => rotate(20)}
        >
          <RotateCw size={15} />
        </button>
      </div>
    </div>
  );
}
