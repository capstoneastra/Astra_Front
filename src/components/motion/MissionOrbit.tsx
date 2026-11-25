import { useEffect, useRef } from "react";
import { useCinematicMotion } from "../../motion/useCinematicMotion";

/** Original decorative space scene; it represents no equipment or live telemetry. */
export default function MissionOrbit() {
  const host = useRef<HTMLDivElement>(null);
  const { enabled } = useCinematicMotion();

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let release: (() => void) | undefined;
    void import("./OrbitalScene").then(({ mountOrbitalScene }) => {
      if (disposed) return;
      try {
        release = mountOrbitalScene(element, enabled);
      } catch {
        // CSS atmosphere and satellite remain visible when WebGL is unavailable.
        element.dataset.scene = "fallback";
      }
    }).catch(() => {
      if (!disposed) element.dataset.scene = "fallback";
    });
    return () => { disposed = true; release?.(); };
  }, [enabled]);

  return <div className="mission-orbit" ref={host} aria-hidden="true">
    <div className="mission-orbit__nebula" />
    <div className="mission-orbit__horizon" />
    <div className="mission-orbit__fallback-satellite"><i /><b /><i /></div>
    <div className="mission-orbit__sunrise" />
    <svg className="mission-orbit__signals" viewBox="0 0 800 480" fill="none">
      <g className="mission-orbit__signal-ring">
        <ellipse cx="470" cy="238" rx="275" ry="112" transform="rotate(-24 470 238)" />
        <ellipse cx="470" cy="238" rx="302" ry="142" transform="rotate(-24 470 238)" />
      </g>
      <path className="mission-orbit__signal-track" d="M160 353C272 269 553 173 744 143" />
      <g className="mission-orbit__signal-node">
        <circle cx="664" cy="159" r="3" />
        <circle className="mission-orbit__signal-pulse" cx="664" cy="159" r="11" />
        <path d="M664 139v-8m0 56v-8m-20-20h-8m56 0h-8" />
      </g>
    </svg>
    <div className="mission-orbit__streak mission-orbit__streak--one" />
    <div className="mission-orbit__streak mission-orbit__streak--two" />
    <div className="mission-orbit__frame" />
  </div>;
}
