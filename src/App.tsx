import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from "react";
// 화면별 CSS — 화면 코드는 필요할 때 따로 받지만(lazy), CSS 는 적용 순서가 바뀌지 않도록 여기서 이 순서대로 한 번에 불러옵니다.
import "./styles/dashboard.css";
import "./styles/search.css";
import "./styles/request-form.css";
import "./styles/requests.css";
import "./styles/manager.css";
import "./auth/login.css";
import "./styles/compare.css";
import "./styles/quick-sim.css";
import "./styles/quick-request.css";
import "./styles/admin.css";
import "./styles/calendar.css";
import { useLocation, useNavigationType } from "react-router";
import Sidebar from "./components/Sidebar";
import Home from "./components/Home";
import EquipmentSearch from "./components/EquipmentSearch";
import AppHeader from "./components/layout/AppHeader";
import { AppContext } from "./context/AppContext";
import type { Equipment } from "./services/equipmentService";
import type { MatchRun, RequestBox } from "./services/contracts";
import AuthProvider from "./auth/AuthProvider";
import AuthGate from "./auth/AuthGate";
import { useAuth } from "./auth/context";
import { canAccessMenu } from "./auth/permissions";
import { useApiQuery } from "./hooks/useApiQuery";
import { equipmentService, testTypeLabel } from "./services/equipmentService";
import type { SearchSuggestion } from "./components/layout/QuickSearch";
import { defaultDashboardView } from "./services/dashboardService";
import { ApiError } from "./api/errors";
import ApiState from "./components/ui/ApiState";
import AiAssistant from "./components/assistant/AiAssistant";
import RequestDetailDialog from "./components/workflow/RequestDetailDialog";
import type { NotificationTarget } from "./domain/notificationTarget";
import { useWorkspaceNavigation } from "./hooks/useWorkspaceNavigation";
import { addRecentSearch } from "./domain/recentSearches";
import { useSidebarCollapse } from "./hooks/useSidebarCollapse";
// v6 공통 여백·모션 — 각 화면 CSS 뒤에 오도록 마지막에 불러옵니다.
import "./styles/v6.css";
import "./styles/v9.css";
import "./styles/v10.css";
import "./styles/palette.css";

/** 처음 화면(홈·장비 검색) 밖의 화면은 들어갈 때 받는다. 로그인 직후 여유 시간에 미리 받아 두어 이동은 바로 열림 */
const screenLoaders = {
  Reservation: () => import("./components/Reservation"),
  ReservationCheck: () => import("./components/ReservationCheck"),
  EquipmentManager: () => import("./components/EquipmentManager"),
  Matching: () => import("./components/Matching"),
  EquipmentCompare: () => import("./components/EquipmentCompare"),
  TestInformation: () => import("./components/TestInformation"),
  Simulation: () => import("./components/Simulation"),
  QuickRequest: () => import("./components/QuickRequest"),
  AdminManagement: () => import("./components/AdminManagement"),
  AdminStats: () => import("./components/AdminStats"),
  Notifications: () => import("./components/Notifications"),
  ReservationCalendar: () => import("./components/ReservationCalendar"),
};
const Reservation = lazy(screenLoaders.Reservation);
const ReservationCheck = lazy(screenLoaders.ReservationCheck);
const EquipmentManager = lazy(screenLoaders.EquipmentManager);
const Matching = lazy(screenLoaders.Matching);
const EquipmentCompare = lazy(screenLoaders.EquipmentCompare);
const TestInformation = lazy(screenLoaders.TestInformation);
const Simulation = lazy(screenLoaders.Simulation);
const QuickRequest = lazy(screenLoaders.QuickRequest);
const AdminManagement = lazy(screenLoaders.AdminManagement);
const AdminStats = lazy(screenLoaders.AdminStats);
const Notifications = lazy(screenLoaders.Notifications);
const ReservationCalendar = lazy(screenLoaders.ReservationCalendar);

function prefetchScreens() {
  const run = () => Object.values(screenLoaders).forEach((load) => void load().catch(() => undefined));
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}

/** 장비 목록을 불러오는 동안 쓰는 빈 배열 — 렌더마다 새 []를 만들면 이를 쓰는 memo 가 매번 다시 계산됨 */
const EMPTY_EQUIPMENT: Equipment[] = [];

function Workspace() {
  useEffect(() => prefetchScreens(), []);
  const { user } = useAuth();
  const workspaceNavigation = useWorkspaceNavigation(
    `${user.id}:${user.role}:${user.organization?.id ?? ""}`,
  );
  const activeMenu = workspaceNavigation.route.menu;
  const [requirementId, setRequirementId] = useState<number | null>(null);
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);
  const [chatPanelKey, setChatPanelKey] = useState(0);
  const [matchRun, setMatchRun] = useState<MatchRun | null>(null);
  const [draftRequestId, setDraftRequestId] = useState<number | null>(null);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);
  const [testTypeCode, setTestTypeCode] = useState("VIBRATION");
  const [simulationEquipmentId, setSimulationEquipmentId] = useState<number | null>(null);
  const [autoRunId, setAutoRunId] = useState<number | null>(null);
  const [testCondition, setTestCondition] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebar = useSidebarCollapse();
  const [calendarBox, setCalendarBox] = useState<RequestBox>();
  const [dashboardView, setDashboardView] = useState(() => defaultDashboardView(user.role));
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantStarted, setAssistantStarted] = useState(false);
  const [assistantMode, setAssistantMode] = useState("chatbot");
  const [smallScreen, setSmallScreen] = useState(
    () => window.matchMedia("(max-width: 700px)").matches,
  );
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const { key: locationKey } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== "POP") return;
    const frame = requestAnimationFrame(() => {
      closeAssistant();
      closeMenu();
    });
    return () => cancelAnimationFrame(frame);
  }, [locationKey, navigationType, closeAssistant, closeMenu]);
  const catalogQuery = useApiQuery(
    (signal) => equipmentService.catalog(signal),
    `catalog:${user.id}:${user.role}`,
  );
  const equipmentList = catalogQuery.data ?? EMPTY_EQUIPMENT;
  // 헤더 자동 완성 후보: 장비·기관·시험 종류 (관리자는 기관만)
  const searchSources = useMemo<SearchSuggestion[]>(() => {
    const orgs = new Map<number, { name: string; region?: string; count: number }>();
    const types = new Map<string, number>();
    for (const e of equipmentList) {
      if (e.institutionId != null) {
        const o = orgs.get(e.institutionId) ?? { name: e.institution, region: e.region, count: 0 };
        o.count += 1; orgs.set(e.institutionId, o);
      }
      for (const t of e.testTypes) types.set(t, (types.get(t) ?? 0) + 1);
    }
    const institutions: SearchSuggestion[] = [...orgs].filter(([, o]) => o.name).map(([id, o]) => ({
      kind: "institution", label: o.name, sub: `${o.region ?? ""}${o.region ? " · " : ""}장비 ${o.count}대`,
      query: user.role === "ADMIN" ? o.name : "", options: user.role === "ADMIN" ? undefined : { institutionId: id },
    }));
    if (user.role === "ADMIN") return institutions;
    return [
      ...equipmentList.map((e) => ({ kind: "equipment" as const, label: e.name, sub: e.institution, query: e.name })),
      ...institutions,
      ...[...types].map(([code, n]) => ({ kind: "testType" as const, label: testTypeLabel(code), sub: `장비 ${n}대`, query: "", options: { testType: code } })),
    ];
  }, [equipmentList, user.role]);
  // 검색창을 처음 열었을 때의 추천 검색어: 장비가 많은 시험 종류 4개 + 장비가 많은 기관 2곳
  const searchRecommendations = useMemo<SearchSuggestion[]>(() => {
    const bySize = (a: SearchSuggestion, b: SearchSuggestion) => Number(/\d+/.exec(b.sub ?? "")?.[0] ?? 0) - Number(/\d+/.exec(a.sub ?? "")?.[0] ?? 0);
    const types = searchSources.filter((x) => x.kind === "testType").sort(bySize).slice(0, 4);
    const orgs = searchSources.filter((x) => x.kind === "institution").sort((a, b) => Number(/장비 (\d+)/.exec(b.sub ?? "")?.[1] ?? 0) - Number(/장비 (\d+)/.exec(a.sub ?? "")?.[1] ?? 0))
      .slice(0, user.role === "ADMIN" ? 5 : 2);
    return [...types, ...orgs];
  }, [searchSources, user.role]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const restoreDesktop = () => {
      if (desktop.matches) closeMenu();
    };
    desktop.addEventListener("change", restoreDesktop);
    return () => desktop.removeEventListener("change", restoreDesktop);
  }, [closeMenu]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setSmallScreen(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const openAssistant = (mode?: string) => {
    if (!canAccessMenu(user.role, mode ?? "assistant")) return;
    if (mode) setAssistantMode(mode);
    setAssistantStarted(true);
    setAssistantOpen(true);
    setMenuOpen(false);
  };

  const navigate = (menu: string) => {
    if (
      ["assistant", "chatbot", "autopilot"].includes(menu) &&
      canAccessMenu(user.role, menu)
    ) {
      openAssistant(menu === "assistant" ? undefined : menu);
      return;
    }
    workspaceNavigation.go(menu);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const searchEquipment = (query: string, options: { institutionId?: number | null; testType?: string; region?: string } = {}) => {
    addRecentSearch(user.id, query);
    workspaceNavigation.go("search", {
      searchTerm: query, institutionId: options.institutionId ?? null,
      ...(options.testType ? { testType: options.testType } : {}), ...(options.region ? { region: options.region } : {}),
    });
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // 알림에서 바로 해당 작업으로 이동합니다. 의뢰는 현재 화면 위에 상세 창으로 엽니다.
  const [requestDialog, setRequestDialog] = useState<{ id: number; box?: RequestBox } | null>(null);
  const openTarget = (target: NotificationTarget) => {
    if (target.kind === "request") {
      setRequestDialog({ id: target.id, box: user.role === "ADMIN" ? undefined : user.role === "INSTITUTION_MANAGER" ? "RECEIVED" : "SENT" });
      return;
    }
    if (target.menu === "admin") workspaceNavigation.go("admin", null, { approvalFocus: target.focus });
    else navigate(target.menu);
  };

  const openChat = (id: number) => {
    if (chatSessionId !== id) {
      setChatSessionId(id);
      setChatPanelKey((key) => key + 1);
      setTestCondition("");
      setRequirementId(null);
      setMatchRun(null);
    }
    openAssistant("chatbot");
  };

  const renderContent = () => {
    if (!canAccessMenu(user.role, activeMenu))
      return (
        <ApiState
          error={
            new ApiError("현재 계정의 역할로는 이 기능을 이용할 수 없습니다.", {
              status: 403,
              code: "FORBIDDEN",
            })
          }
        />
      );
    switch (activeMenu) {
      case "home":
        return <Home view={dashboardView} setActiveMenu={navigate} onSearch={searchEquipment}
          openRequests={(box, status) => workspaceNavigation.go(box === "RECEIVED" ? "review" : "reservationCheck", null, { requestStatus: status })}
          openChat={openChat}
          openApprovals={(approvalFocus) => workspaceNavigation.go("admin", null, { approvalFocus })} />;
      case "search":
        return (
          <EquipmentSearch
            key={workspaceNavigation.route.index}
            initialView={workspaceNavigation.route.search}
            initialSearchTerm={workspaceNavigation.route.search?.searchTerm ?? ""}
            initialInstitutionId={workspaceNavigation.route.search?.institutionId ?? null}
            onViewChange={workspaceNavigation.saveSearch}
            setActiveMenu={navigate}
          />
        );
      case "reservation":
        return (
          <Reservation key={draftRequestId ?? "new"} setActiveMenu={navigate} />
        );
      case "reservationCheck":
      case "review":
        return <ReservationCheck key={`${activeMenu}:${workspaceNavigation.route.index}`} setActiveMenu={navigate} institutionView={activeMenu === "review"}
          initialStatus={workspaceNavigation.route.requestStatus} />;
      case "calendar":
        return <ReservationCalendar requestBox={calendarBox} onBoxChange={setCalendarBox} />;
      case "matching":
        return <Matching setActiveMenu={navigate} />;
      case "compare":
        return <EquipmentCompare setActiveMenu={navigate} />;
      case "testInfo":
        return <TestInformation setActiveMenu={navigate} />;
      case "simulation":
        return <Simulation setActiveMenu={navigate} />;
      case "quickRequest":
        return <QuickRequest key={workspaceNavigation.route.index} setActiveMenu={navigate} />;
      case "admin":
        return <AdminManagement key={workspaceNavigation.route.index} approvalFocus={workspaceNavigation.route.approvalFocus}
          initialKeyword={workspaceNavigation.route.search?.searchTerm ?? ""} />;
      case "stats":
        return <AdminStats />;
      case "notifications":
        return <Notifications onOpenTarget={openTarget} />;
      case "manager":
        return <EquipmentManager />;
      default:
        return (
          <ApiState
            error={
              new ApiError("아직 연결되지 않은 화면입니다.", {
                status: 404,
                code: "NOT_FOUND",
              })
            }
          />
        );
    }
  };

  // 전역 상태 — 값이 바뀔 때만 새 객체를 만들어, 이 값을 쓰는 화면들이 쓸데없이 다시 그려지지 않게
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; });
  const contextValue = useMemo(() => ({
        testCondition,
        setTestCondition,
        selectedEquipment,
        setSelectedEquipment,
        equipmentList,
        catalogQuery,
        user,
        resolveEquipment: equipmentService.detail,
        requirementId,
        setRequirementId,
        chatSessionId,
        setChatSessionId,
        matchRun,
        setMatchRun,
        draftRequestId,
        setDraftRequestId,
        comparisonIds,
        setComparisonIds,
        testTypeCode,
        setTestTypeCode,
        simulationEquipmentId,
        setSimulationEquipmentId,
        autoRunId,
        setAutoRunId,
        openSimulation: (id) => {
          setSimulationEquipmentId(id);
          navigateRef.current("simulation");
        },
        openTestInfo: (code) => {
          setTestTypeCode(code);
          navigateRef.current("testInfo");
        },
      }), [
    testCondition, selectedEquipment, equipmentList, catalogQuery, user, requirementId, chatSessionId, matchRun,
    draftRequestId, comparisonIds, testTypeCode, simulationEquipmentId, autoRunId,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-shell" data-sidebar-collapsed={sidebar.collapsed}>
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
        >
          본문으로 건너뛰기
        </a>
        <Sidebar
          activeMenu={activeMenu}
          setActiveMenu={navigate}
          open={menuOpen}
          onClose={closeMenu}
          collapsed={sidebar.collapsed}
          onToggleCollapse={sidebar.toggle}
          blocked={assistantOpen && smallScreen}
        />
        <div
          className="app-body"
          ref={(node) => {
            if (node) node.inert = menuOpen || (assistantOpen && smallScreen);
          }}
        >
          <AppHeader
            activeMenu={activeMenu}
            menuOpen={menuOpen}
            onMenu={() => setMenuOpen(true)}
            searchSources={searchSources}
            searchRecommendations={searchRecommendations}
            dashboardView={dashboardView}
            onDashboardView={setDashboardView}
            onSearch={(query, options) => {
              if (user.role !== "ADMIN") return searchEquipment(query, options);
              addRecentSearch(user.id, query);
              workspaceNavigation.go("admin", query ? { searchTerm: query, institutionId: null } : null);
            }}
            onNotifications={() => navigate("notifications")}
            onOpenTarget={openTarget}
          />
          <main id="main-content" className="main-content" tabIndex={-1}>
            <Suspense fallback={<ApiState loading />}>{renderContent()}</Suspense>
          </main>
          {requestDialog && <RequestDetailDialog key={requestDialog.id} requestId={requestDialog.id}
            requestBox={requestDialog.box} onClose={() => setRequestDialog(null)} />}
        </div>
        {canAccessMenu(user.role, "assistant") && (
          <AiAssistant
            chatPanelKey={chatPanelKey}
            open={assistantOpen}
            started={assistantStarted}
            mode={assistantMode}
            modal={smallScreen}
            onOpen={() => openAssistant()}
            onClose={closeAssistant}
            onModeChange={setAssistantMode}
            onNavigate={(menu) => {
              closeAssistant();
              navigate(menu);
              requestAnimationFrame(() =>
                document.getElementById("main-content")?.focus(),
              );
            }}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}

function AuthenticatedWorkspace() {
  const { user } = useAuth();
  return (
    <Workspace key={`${user.id}:${user.role}:${user.organization?.id ?? ""}`} />
  );
}

function WorkspaceEntry() {
  return <AuthGate><AuthenticatedWorkspace /></AuthGate>;
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceEntry />
    </AuthProvider>
  );
}
