import { useEffect, useState } from "react";

const storageKey = "astra.sidebar.layout";
const compactDesktop = "(min-width: 1024px) and (max-width: 1279px)";

function readPreference() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "collapsed") return true;
    if (saved === "expanded") return false;
  } catch {
    // The setting is optional when browser storage is unavailable.
  }
  return null;
}

export function useSidebarCollapse() {
  const [preference, setPreference] = useState(readPreference);
  const [compact, setCompact] = useState(() => window.matchMedia(compactDesktop).matches);
  const collapsed = preference ?? compact;

  useEffect(() => {
    const media = window.matchMedia(compactDesktop);
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function toggle() {
    const next = !collapsed;
    setPreference(next);
    try {
      window.localStorage.setItem(storageKey, next ? "collapsed" : "expanded");
    } catch {
      // Keep the selection for the current page.
    }
  }

  return { collapsed, toggle };
}
