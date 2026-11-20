import { useCallback, useEffect, useRef, useState } from "react";
import { menuPermissions } from "../auth/permissions";

const isPage = (menu) => Object.hasOwn(menuPermissions, menu) &&
  !["assistant", "chatbot", "autopilot"].includes(menu);
const urlFor = (menu) => menu === "home" ? "/" : `/#/${menu}`;
const menuFromUrl = () => {
  const menu = window.location.hash.slice(2);
  return isPage(menu) ? menu : "home";
};
const readRoute = (scope) => {
  const saved = window.history.state?.astraWorkspace;
  return saved?.scope === scope && isPage(saved.menu)
    ? saved
    : { scope, menu: saved && saved.scope !== scope ? "home" : menuFromUrl(), index: 0, search: null };
};

export function useWorkspaceNavigation(scope) {
  const [route, setRoute] = useState(() => readRoute(scope));
  const current = useRef(route);
  const persist = useCallback((next, push = false) => {
    current.current = next;
    window.history[push ? "pushState" : "replaceState"](
      { ...window.history.state, astraWorkspace: next }, "", urlFor(next.menu),
    );
    setRoute(next);
  }, []);
  useEffect(() => {
    // Replace the login entry; do not leave an authenticated screen under /auth.
    window.history.replaceState({ ...window.history.state, astraWorkspace: current.current }, "", urlFor(current.current.menu));
    const pop = () => {
      const saved = window.history.state?.astraWorkspace;
      // Entries from a different account never restore its workspace state.
      const next = saved?.scope === scope && isPage(saved.menu)
        ? saved : { scope, menu: saved && saved.scope !== scope ? "home" : menuFromUrl(), index: 0, search: null };
      persist(next);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [scope, persist]);
  const go = useCallback((menu, search = null) => {
    if (!isPage(menu)) return;
    const previous = current.current;
    if (previous.menu === menu && JSON.stringify(previous.search) === JSON.stringify(search)) return;
    persist({ scope, menu, search, index: previous.index + 1 }, true);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [scope, persist]);
  const saveSearch = useCallback((search) => {
    if (current.current.menu !== "search" || JSON.stringify(current.current.search) === JSON.stringify(search)) return;
    persist({ ...current.current, search });
  }, [persist]);
  const back = useCallback(() => {
    if (current.current.index > 0) window.history.back();
    else go("home");
  }, [go]);
  return { route, go, back, saveSearch, canGoBack: route.index > 0 || route.menu !== "home" };
}
