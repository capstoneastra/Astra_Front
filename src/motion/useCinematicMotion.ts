import { useSyncExternalStore } from "react";

const reducedQuery = "(prefers-reduced-motion: reduce)";

const readReducedMotion = () => window.matchMedia(reducedQuery).matches;
function subscribeReducedMotion(listener: () => void) {
  const media = window.matchMedia(reducedQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function useCinematicMotion() {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => true);
  return {
    enabled: !reducedMotion,
    reducedMotion,
  };
}
