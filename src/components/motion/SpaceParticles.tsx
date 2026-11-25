import { useEffect, useRef } from "react";

export default function SpaceParticles({ enabled }: { enabled: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    let width = 0, height = 0, frame = 0, running = false, last = 0, time = 0;
    const stars = Array.from({ length: 160 }, (_, i) => {
      const seeded = (n: number) => { const a = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return a - Math.floor(a); };
      return { x: seeded(1), y: seeded(2), depth: seeded(3), phase: seeded(4) * Math.PI * 2 };
    });
    function draw() {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const x = (star.x * width + time * (1 + star.depth * 2)) % width;
        const y = (star.y * height - time * star.depth * .5 + height) % height;
        context.fillStyle = `rgba(180,219,255,${.13 + star.depth * .32 + Math.sin(time * .6 + star.phase) * .1})`;
        context.beginPath(); context.arc(x, y, .4 + star.depth * .8, 0, Math.PI * 2); context.fill();
      }
    }
    function render(now: number) {
      if (!running) return;
      frame = requestAnimationFrame(render);
      if (now - last < 40) return;
      time += Math.min((now - last) / 1000, .1); last = now; draw();
    }
    function sync() {
      running = enabled && !document.hidden;
      cancelAnimationFrame(frame);
      if (running) { last = performance.now(); frame = requestAnimationFrame(render); }
    }
    const resize = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect(); width = rect.width; height = rect.height;
      const ratio = Math.min(window.devicePixelRatio, 1.5);
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
    });
    resize.observe(element);
    document.addEventListener("visibilitychange", sync); sync();
    return () => { running = false; cancelAnimationFrame(frame); resize.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, [enabled]);
  return <canvas className="space-particles" ref={canvas} />;
}
