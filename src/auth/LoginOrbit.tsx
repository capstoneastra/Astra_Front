import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

const orbit = { cx: 720, cy: 450, rx: 590, ry: 235 };
const orbitDuration = 24000;
const orbitSteps = 128;
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

const orbitPoints = Array.from({ length: orbitSteps + 1 }, (_, index) => {
  const angle = -Math.PI / 2 + index * 2 * Math.PI / orbitSteps;
  return {
    x: orbit.cx + orbit.rx * Math.cos(angle),
    y: orbit.cy + orbit.ry * Math.sin(angle),
  };
});
const orbitDistances = [0];
for (let index = 1; index < orbitPoints.length; index++) {
  const point = orbitPoints[index];
  const previous = orbitPoints[index - 1];
  orbitDistances.push(orbitDistances[index - 1] + Math.hypot(point.x - previous.x, point.y - previous.y));
}
const orbitLength = orbitDistances[orbitSteps];
// Time each segment by its length so the dot moves at a steady speed.
const orbitKeyframes = orbitPoints.map(({ x, y }, index) => ({
  transform: `translate(${x}px, ${y}px)`,
  offset: orbitDistances[index] / orbitLength,
}));

function subscribeToReducedMotion(update: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}

function visibleOrbitTime(ellipse: SVGEllipseElement, time: number) {
  const matrix = ellipse.getScreenCTM();
  if (!matrix) return time;

  const card = ellipse.closest(".login-experience")?.querySelector(".login-card")?.getBoundingClientRect();
  const progress = (time % orbitDuration) / orbitDuration;
  const first = orbitKeyframes.findIndex(({ offset }) => offset >= progress);
  const viewportMargin = 16;
  const cardMargin = 12;
  for (let step = 0; step < orbitSteps; step++) {
    const index = (first + step) % orbitSteps;
    const point = orbitPoints[index];
    const x = matrix.a * point.x + matrix.c * point.y + matrix.e;
    const y = matrix.b * point.x + matrix.d * point.y + matrix.f;
    const inViewport = x >= viewportMargin && x <= window.innerWidth - viewportMargin &&
      y >= viewportMargin && y <= window.innerHeight - viewportMargin;
    const behindCard = card && x >= card.left - cardMargin && x <= card.right + cardMargin &&
      y >= card.top - cardMargin && y <= card.bottom + cardMargin;
    if (inViewport && !behindCard) {
      if (step === 0) return time;
      const offset = (orbitKeyframes[index].offset - progress + 1) % 1;
      return time + offset * orbitDuration;
    }
  }
  return time;
}

export default function LoginOrbit() {
  const linesRef = useRef<HTMLDivElement>(null);
  const ellipseRef = useRef<SVGEllipseElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );

  useLayoutEffect(() => {
    const ellipse = ellipseRef.current;
    const dot = dotRef.current;
    if (!ellipse || !dot || reducedMotion) return;

    const animation = dot.animate(orbitKeyframes, { duration: orbitDuration, iterations: Infinity });
    const resume = () => {
      if (document.hidden) return;
      const currentTime = animation.currentTime;
      const time = typeof currentTime === "number" && Number.isFinite(currentTime)
        ? Math.max(0, currentTime)
        : 0;
      animation.currentTime = visibleOrbitTime(ellipse, time);
      animation.play();
    };

    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    resume();
    return () => {
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      animation.cancel();
    };
  }, [reducedMotion]);

  useEffect(() => {
    const lines = linesRef.current;
    if (!lines || reducedMotion) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    let lastTime = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      lines.style.setProperty("--orbit-x", x.toFixed(4));
      lines.style.setProperty("--orbit-y", y.toFixed(4));
    };
    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      targetX = targetY = x = y = 0;
      paint();
    };
    const canTrack = () => finePointer.matches && !document.hidden;
    function tick(now: number) {
      frame = 0;
      if (!canTrack()) {
        stop();
        return;
      }
      const elapsed = lastTime ? Math.min(32, Math.max(1, now - lastTime)) : 16.667;
      lastTime = now;
      const blend = 1 - Math.exp(-elapsed / 248);
      x += (targetX - x) * blend;
      y += (targetY - y) * blend;
      const settled = Math.abs(targetX - x) < 0.0008 && Math.abs(targetY - y) < 0.0008;
      if (settled) {
        x = targetX;
        y = targetY;
        lastTime = 0;
      }
      paint();
      if (!settled) requestTick();
    }
    function requestTick() {
      if (!frame && canTrack()) frame = window.requestAnimationFrame(tick);
    }
    const trackPointer = (event: PointerEvent) => {
      if (!canTrack() || event.pointerType === "touch") return;
      const width = document.documentElement.clientWidth;
      targetX = Math.max(-1, Math.min(1, (event.clientX / width) * 2 - 1));
      targetY = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
      requestTick();
    };
    const leave = () => {
      targetX = targetY = 0;
      requestTick();
    };
    const updateVisibility = () => {
      if (document.hidden) stop();
    };

    window.addEventListener("pointermove", trackPointer, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("blur", stop);
    window.addEventListener("resize", stop);
    document.addEventListener("visibilitychange", updateVisibility);
    finePointer.addEventListener("change", stop);
    updateVisibility();
    return () => {
      window.removeEventListener("pointermove", trackPointer);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", stop);
      window.removeEventListener("resize", stop);
      document.removeEventListener("visibilitychange", updateVisibility);
      finePointer.removeEventListener("change", stop);
      stop();
    };
  }, [reducedMotion]);

  return (
    <div className="login-orbit" aria-hidden="true">
      <div className="login-orbit__camera">
        <div className="login-orbit__world">
          <div className="login-orbit__circle login-orbit__circle--one" />
          <div className="login-orbit__circle login-orbit__circle--two" />
          <div className="login-orbit__lines" ref={linesRef}>
            <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
              <g transform="rotate(-22 720 450)" fill="none" stroke="currentColor">
                <ellipse ref={ellipseRef} {...orbit} strokeWidth="1" />
                <ellipse cx="720" cy="450" rx="610" ry="255" strokeWidth=".6" strokeDasharray="3 11" />
                <circle
                  ref={dotRef}
                  style={{ transform: orbitKeyframes[0].transform }}
                  r="4"
                  fill="var(--login-orbit-dot)"
                  stroke="none"
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
