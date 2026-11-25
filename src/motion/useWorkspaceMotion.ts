import { useEffect } from "react";
import type { RefObject } from "react";

const revealSelector = ".page-header, .dashboard-search, .metric-card, .panel, .equipment-card, .request-card";
const spotlightSelector = ".panel, .metric-card, .equipment-card, .dashboard-search";

// Decorative DOM attributes only. No changes to navigation, forms or API state.
export function useWorkspaceMotion(ref: RefObject<HTMLElement | null>, enabled: boolean, scene: string) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const registered = new Set<HTMLElement>();
    let order = 0;
    const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.cinematicReveal = "visible";
        observer?.unobserve(entry.target);
      }
    }, { threshold: 0.04 }) : null;

    const register = (node: HTMLElement) => {
      if (!observer || registered.has(node) || node.closest("dialog")) return;
      registered.add(node);
      node.style.setProperty("--reveal-delay", `${(order++ % 4) * 65}ms`);
      node.dataset.cinematicReveal = "pending";
      observer.observe(node);
    };
    const scan = (node: HTMLElement) => {
      if (node.matches(revealSelector)) register(node);
      node.querySelectorAll<HTMLElement>(revealSelector).forEach(register);
    };
    scan(root);
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => { if (node instanceof HTMLElement) scan(node); });
      }
      for (const node of registered) {
        if (!root.contains(node)) { observer?.unobserve(node); registered.delete(node); }
      }
    });
    mutations.observe(root, { childList: true, subtree: true });

    let frame = 0;
    const followPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      cancelAnimationFrame(frame);
      const { clientX, clientY } = event;
      const card = event.target instanceof Element ? event.target.closest<HTMLElement>(spotlightSelector) : null;
      if (!card) return;
      frame = requestAnimationFrame(() => {
        const bounds = card.getBoundingClientRect();
        card.style.setProperty("--spotlight-x", `${clientX - bounds.left}px`);
        card.style.setProperty("--spotlight-y", `${clientY - bounds.top}px`);
      });
    };
    root.addEventListener("pointermove", followPointer, { passive: true });
    const workspace = root.closest<HTMLElement>(".cinematic-workspace") ?? root;
    const clicks = new Map<Animation, HTMLElement>();
    const ripple = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>("button:not(:disabled)") : null;
      if (!button || !workspace.contains(button)) return;
      const bounds = button.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const size = Math.max(bounds.width, bounds.height);
      const wave = document.createElement("span");
      wave.className = "interaction-ripple"; wave.setAttribute("aria-hidden", "true");
      wave.style.width = wave.style.height = `${size}px`;
      wave.style.left = `${(event.detail ? event.clientX - bounds.left : bounds.width / 2) - size / 2}px`;
      wave.style.top = `${(event.detail ? event.clientY - bounds.top : bounds.height / 2) - size / 2}px`;
      button.append(wave);
      const animation = wave.animate([{ transform: "scale(0)", opacity: .65 }, { transform: "scale(2.2)", opacity: 0 }], { duration: 460, easing: "ease-out" });
      clicks.set(animation, wave);
      const remove = () => { clicks.delete(animation); wave.remove(); };
      void animation.finished.then(remove, remove);
    };
    workspace.addEventListener("click", ripple);
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", followPointer);
      workspace.removeEventListener("click", ripple);
      clicks.forEach((wave, animation) => { animation.cancel(); wave.remove(); });
      for (const node of registered) {
        delete node.dataset.cinematicReveal;
        node.style.removeProperty("--reveal-delay");
        node.style.removeProperty("--spotlight-x");
        node.style.removeProperty("--spotlight-y");
      }
    };
  }, [ref, enabled, scene]);
}
