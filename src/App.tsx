import { lazy, Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";
import Sidebar from "./components/Sidebar";
import RoleDashboard from "./components/dashboard/RoleDashboard";
import EquipmentSearch from "./components/EquipmentSearch";
import Reservation from "./components/Reservation";
import ReservationCheck from "./components/ReservationCheck";
import EquipmentManager from "./components/EquipmentManager";
import AppHeader from "./components/layout/AppHeader";
import { AppContext } from "./context/AppContext";
import type { LocalReservation } from "./context/AppContext";
import type { Equipment } from "./services/equipmentService";
import type { MatchRun, ResourceId } from "./services/contracts";
import AuthProvider from "./auth/AuthProvider";
import AuthGate from "./auth/AuthGate";
import { useAuth } from "./auth/context";
import { canAccessMenu } from "./auth/permissions";
import { useApiQuery } from "./hooks/useApiQuery";
import { equipmentService } from "./services/equipmentService";
import { dashboardService } from "./services/dashboardService";
import { apiConfig } from "./api/config";
import { ApiError } from "./api/errors";
import ApiState from "./components/ui/ApiState";
import Matching from "./components/Matching";
import EquipmentCompare from "./components/EquipmentCompare";
import TestInformation from "./components/TestInformation";
import DuplicateEquipment from "./components/DuplicateEquipment";
import AiAssistant from "./components/assistant/AiAssistant";
import Simulation from "./components/Simulation";
import AdminManagement from "./components/AdminManagement";
import Notifications from "./components/Notifications";
import AccountSettings from "./components/AccountSettings";
import ReservationCalendar from "./components/ReservationCalendar";
import { useWorkspaceNavigation } from "./hooks/useWorkspaceNavigation";
import CinematicBackdrop from "./components/motion/CinematicBackdrop";
import { useCinematicMotion } from "./motion/useCinematicMotion";
import { useWorkspaceMotion } from "./motion/useWorkspaceMotion";
import "./styles/cinematic.css";
import "./styles/workspace-feedback.css";
import "./styles/workspace-density.css";
import "./styles/account-operations.css";
import SearchContext from "./components/layout/SearchContext";
import { menuLabels } from "./data/navigation";

const PreviewProvider = import.meta.env.DEV
  ? lazy(() => import("./preview/PreviewProvider"))
  : null;
const DemoAuthProvider = (import.meta.env.DEV || (import.meta.env.MODE === "public-demo" && import.meta.env.VITE_PUBLIC_DEMO === "true")) ? lazy(() => import("./demo/DemoAuthProvider")) : null;

function Workspace() {
  const { user } = useAuth();
  const [workspaceView, setWorkspaceView] = useState<"REQUESTER" | "PROVIDER" | "ADMIN">(user.role === "ADMIN" ? "ADMIN" : user.role === "INSTITUTION_MANAGER" ? "PROVIDER" : "REQUESTER");
  const workspacePath = apiConfig.preview?.path ?? "/";
  const workspaceNavigation = useWorkspaceNavigation(
    `${user.id}:${user.role}:${user.organization?.id ?? ""}`,
    workspacePath,
  );
  const activeMenu = workspaceNavigation.route.menu;
  const mainRef = useRef<HTMLElement>(null);
  const motion = useCinematicMotion();
  useWorkspaceMotion(mainRef, motion.enabled, activeMenu);
  const [requirementId, setRequirementId] = useState<number | null>(null);
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);
  const [matchRun, setMatchRun] = useState<MatchRun | null>(null);
  const [draftRequestId, setDraftRequestId] = useState<number | null>(null);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);
  const [testTypeCode, setTestTypeCode] = useState("VIBRATION");
  const [simulationEquipmentId, setSimulationEquipmentId] = useState<number | null>(null);
  const [autoRunId, setAutoRunId] = useState<number | null>(null);
  const [testCondition, setTestCondition] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [localCatalog, setLocalCatalog] = useState<Equipment[] | null>(null);
  const [reservations, setReservations] = useState<LocalReservation[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantLauncherTarget, setAssistantLauncherTarget] = useState<HTMLDivElement | null>(null);
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
  const summaryQuery = useApiQuery(
    (signal) => dashboardService.summary(user.role, signal, workspaceView),
    `summary:${user.id}:${user.role}:${workspaceView}`,
  );
  const isApiMode = !apiConfig.useMockCatalog;
  const equipmentList =
    !isApiMode && localCatalog !== null
      ? localCatalog
      : (catalogQuery.data ?? []);
  const setEquipmentList = (value: Equipment[]) => {
    if (!isApiMode) setLocalCatalog(value);
  };
  const resolveEquipment = (id: ResourceId, signal?: AbortSignal) =>
    !isApiMode
      ? Promise.resolve(equipmentList.find((item) => item.id === Number(id)))
      : equipmentService.detail(id, signal);

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
    const fromSearch = activeMenu === "search" || workspaceNavigation.route.origin === "search";
    const origin = fromSearch && ["compare", "matching", "reservation", "simulation", "testInfo"].includes(menu) ? "search" : undefined;
    workspaceNavigation.go(menu, origin || (fromSearch && menu === "search") ? workspaceNavigation.route.search : null, origin);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const searchEquipment = (query: string, options: { institutionId?: number | null } = {}) => {
    workspaceNavigation.go("search", { searchTerm: query, institutionId: options.institutionId ?? null });
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
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
        return <RoleDashboard setActiveMenu={navigate} onSearch={searchEquipment} />;
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
        return <ReservationCheck setActiveMenu={navigate} />;
      case "calendar":
        return <ReservationCalendar onAiLauncherTarget={setAssistantLauncherTarget} />;
      case "review":
        return <ReservationCheck setActiveMenu={navigate} institutionView />;
      case "matching":
        return <Matching setActiveMenu={navigate} />;
      case "compare":
        return <EquipmentCompare />;
      case "testInfo":
        return <TestInformation setActiveMenu={navigate} />;
      case "duplicates":
        return <DuplicateEquipment setActiveMenu={navigate} />;
      case "simulation":
        return <Simulation />;
      case "admin":
        return <AdminManagement />;
      case "notifications":
        return <Notifications />;
      case "settings":
        return <AccountSettings onNavigate={navigate} />;
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

  return (
    <AppContext.Provider
      value={{
        testCondition,
        setTestCondition,
        selectedEquipment,
        setSelectedEquipment,
        equipmentList,
        setEquipmentList,
        reservations,
        setReservations,
        catalogQuery,
        summaryQuery,
        user,
        workspaceView,
        setWorkspaceView: (view) => { setWorkspaceView(view); navigate("home"); closeAssistant(); },
        isApiMode,
        resolveEquipment,
        isMockMode: apiConfig.isMock,
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
          navigate("simulation");
        },
        openTestInfo: (code) => {
          setTestTypeCode(code);
          navigate("testInfo");
        },
      }}
    >
      <div className="app-shell cinematic-workspace" data-page={activeMenu} data-cinematic-motion={motion.enabled ? "on" : "off"}>
        <CinematicBackdrop enabled={motion.enabled} />
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
          activeMenu={assistantOpen ? "assistant" : workspaceNavigation.route.origin === "search" ? "search" : activeMenu}
          setActiveMenu={(menu) => {
            if (["assistant", "chatbot", "autopilot"].includes(menu)) { navigate(menu); return; }
            workspaceNavigation.go(menu);
            setMenuOpen(false);
          }}
          open={menuOpen}
          onClose={closeMenu}
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
            parentLabel={workspaceNavigation.route.origin === "search" ? "시험장비 검색" : undefined}
            onBack={() => { closeAssistant(); closeMenu(); workspaceNavigation.back(); }}
            canGoBack={workspaceNavigation.canGoBack}
            menuOpen={menuOpen}
            onMenu={() => setMenuOpen(true)}
            onSearch={searchEquipment}
            onSettings={() => navigate("settings")}
          />
          <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>
            {workspaceNavigation.route.origin === "search" && <SearchContext title={menuLabels[activeMenu]} onReturn={() => workspaceNavigation.go("search", workspaceNavigation.route.search)} />}
            {renderContent()}
          </main>
          <footer className="app-footer">
            <span>
              ASTRA <i /> 우주항공 시험장비 공동활용 플랫폼
            </span>
          </footer>
        </div>
        {workspaceView === "REQUESTER" && canAccessMenu(user.role, "assistant") && (
          <AiAssistant
            launcherTarget={assistantLauncherTarget}
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

export default function App() {
  if (PreviewProvider && apiConfig.preview)
    return (
      <Suspense fallback={<ApiState loading />}>
        <PreviewProvider account={apiConfig.preview.account}>
          <AuthenticatedWorkspace />
        </PreviewProvider>
      </Suspense>
    );

  if (apiConfig.isMock && DemoAuthProvider) return <Suspense fallback={<ApiState loading />}><DemoAuthProvider><AuthGate><AuthenticatedWorkspace /></AuthGate></DemoAuthProvider></Suspense>;

  return (
    <AuthProvider>
      <AuthGate>
        <AuthenticatedWorkspace />
      </AuthGate>
    </AuthProvider>
  );
}
