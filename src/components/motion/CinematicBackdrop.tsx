import SpaceParticles from "./SpaceParticles";

export default function CinematicBackdrop({ enabled }: { enabled: boolean }) {
  return <div className="cinematic-backdrop" data-ambient-motion={enabled ? "on" : "off"} aria-hidden="true">
    <div className="ambient-glow ambient-glow--indigo" />
    <div className="ambient-glow ambient-glow--teal" />
    <div className="deep-space-aurora deep-space-aurora--one" />
    <div className="deep-space-aurora deep-space-aurora--two" />
    <SpaceParticles enabled={enabled} />
    <div className="space-trail space-trail--one" />
    <div className="space-trail space-trail--two" />
    <div className="telemetry-field" />
    <div className="ambient-vignette" />
  </div>;
}
