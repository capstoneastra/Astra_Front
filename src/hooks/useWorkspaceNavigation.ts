import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { menuPermissions } from "../auth/permissions";

interface SearchView {
  searchTerm: string;
  institutionId: number | null;
  filterType?: string;
  page?: number;
  region?: string;
  testType?: string;
}

interface WorkspaceRoute {
  scope: string;
  menu: string;
  index: number;
  search: SearchView | null;
  origin?: "search";
}

const isPage = (menu: string) =>
  Object.hasOwn(menuPermissions, menu) &&
  !["assistant", "chatbot", "autopilot"].includes(menu);
const hashFor = (menu: string) => (menu === "home" ? "" : `#/${menu}`);
export function useWorkspaceNavigation(scope: string, workspacePath = "/") {
  const { pathname, hash, state } = useLocation();
  const navigate = useNavigate();
  const saved: WorkspaceRoute | undefined = state?.astraWorkspace;
  const sameAccount = saved?.scope === scope;
  const hashMenu = hash.startsWith("#/") && isPage(hash.slice(2)) ? hash.slice(2) : "home";
  const menu = saved && !sameAccount ? "home" : hashMenu;
  const restore = sameAccount && saved.menu === menu;
  const route = useMemo<WorkspaceRoute>(
    () => restore ? saved : { scope, menu, index: 0, search: null },
    [restore, saved, scope, menu],
  );

  const persist = useCallback((next: WorkspaceRoute, replace: boolean) => {
    navigate(`${workspacePath}${hashFor(next.menu)}`, { replace, state: { astraWorkspace: next } });
  }, [navigate, workspacePath]);

  useEffect(() => {
    if (pathname !== workspacePath || hash !== hashFor(menu) || (!restore && menu === "home"))
      persist(route, true);
  }, [pathname, hash, menu, restore, route, persist, workspacePath]);

  const go = useCallback((nextMenu: string, search: SearchView | null = null, origin?: "search") => {
    if (!isPage(nextMenu)) return;
    if (route.menu === nextMenu && route.origin === origin && JSON.stringify(route.search) === JSON.stringify(search)) return;
    persist({ scope, menu: nextMenu, search, origin, index: route.index + 1 }, false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [persist, route, scope]);

  const saveSearch = useCallback((search: SearchView) => {
    if (route.menu === "search" && JSON.stringify(route.search) !== JSON.stringify(search))
      persist({ ...route, search }, true);
  }, [persist, route]);

  const back = useCallback(() => {
    if (route.index > 0) navigate(-1);
    else go("home");
  }, [go, navigate, route.index]);

  return { route, go, back, saveSearch, canGoBack: route.index > 0 || route.menu !== "home" };
}
