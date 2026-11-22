import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Sidebar from "./components/Sidebar";
import Home from "./components/Home";
import EquipmentSearch from "./components/EquipmentSearch";
import Reservation from "./components/Reservation";
import ReservationCheck from "./components/ReservationCheck";
import EquipmentManager from "./components/EquipmentManager";
import AppHeader from "./components/layout/AppHeader";
import { AppContext } from "./context/AppContext";
import type { Equipment } from "./services/equipmentService";
import type { MatchRun, RequestBox } from "./services/contracts";
import AuthProvider from "./auth/AuthProvider";
import AuthGate from "./auth/AuthGate";
import { AuthContext, useAuth } from "./auth/context";
import { canOpenLocalWorkspace, localWorkspaceAccounts } from "./auth/localWorkspace";
import type { LocalWorkspaceAccount } from "./auth/localWorkspace";
import { canAccessMenu } from "./auth/permissions";
import { useApiQuery } from "./hooks/useApiQuery";
import { equipmentService } from "./services/equipmentService";
import { defaultDashboardView } from "./services/dashboardService";
import { queryClient } from "./api/cache";
import { blockLocalWorkspaceRequests } from "./api/client";
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
import ReservationCalendar from "./components/ReservationCalendar";
import { useWorkspaceNavigation } from "./hooks/useWorkspaceNavigation";
import { useSidebarCollapse } from "./hooks/useSidebarCollapse";

function Workspace() {
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
    activeMenu !== "home" || assistantOpen,
  );
  const equipmentList = catalogQuery.data ?? [];

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

  const searchEquipment = (query: string, options: { institutionId?: number | null } = {}) => {
    workspaceNavigation.go("search", { searchTerm: query, institutionId: options.institutionId ?? null });
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const openCalendar = (box?: RequestBox) => {
    setCalendarBox(box);
    navigate("calendar");
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
        return <Home view={dashboardView} onViewChange={setDashboardView} setActiveMenu={navigate} onSearch={searchEquipment}
          openRequests={(box, status) => workspaceNavigation.go(box === "RECEIVED" ? "review" : "reservationCheck", null, { requestStatus: status })}
          openCalendar={openCalendar} openChat={openChat}
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
          initialStatus={workspaceNavigation.route.requestStatus} openCalendar={openCalendar} />;
      case "calendar":
        return <ReservationCalendar requestBox={calendarBox} onBoxChange={setCalendarBox} />;
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
        return <AdminManagement key={workspaceNavigation.route.index} approvalFocus={workspaceNavigation.route.approvalFocus} />;
      case "notifications":
        return <Notifications />;
      case "manager":
        return <EquipmentManager setActiveMenu={navigate} />;
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
          navigate("simulation");
        },
        openTestInfo: (code) => {
          setTestTypeCode(code);
          navigate("testInfo");
        },
      }}
    >
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
          activeMenu={assistantOpen ? "assistant" : activeMenu}
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
            onBack={() => { closeAssistant(); closeMenu(); workspaceNavigation.back(); }}
            canGoBack={workspaceNavigation.canGoBack}
            menuOpen={menuOpen}
            onMenu={() => setMenuOpen(true)}
            onSearch={searchEquipment}
            onNotifications={() => navigate("notifications")}
          />
          <main id="main-content" className="main-content" tabIndex={-1}>
            {renderContent()}
          </main>
          <footer className="app-footer">
            <span>
              ASTRA <i /> 우주항공 시험장비 공동활용 플랫폼
            </span>
            <span>
              {user.name}{user.organization?.name && ` · ${user.organization.name}`}
            </span>
          </footer>
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
  const navigate = useNavigate();
  const [localAccount, setLocalAccount] = useState<LocalWorkspaceAccount | null>(null);
  const [localQueries] = useState(() => new QueryClient({ defaultOptions: queryClient.getDefaultOptions() }));
  const unblockApi = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    localQueries.clear();
    unblockApi.current?.();
  }, [localQueries]);

  useEffect(() => {
    if (localAccount || !unblockApi.current) return;
    localQueries.clear();
    unblockApi.current();
    unblockApi.current = null;
  }, [localAccount, localQueries]);

  const enterLocal = (account: LocalWorkspaceAccount) => {
    if (!canOpenLocalWorkspace() || unblockApi.current) return;
    unblockApi.current = blockLocalWorkspaceRequests();
    setLocalAccount(account);
    navigate("/", { replace: true });
  };

  if (localAccount) return (
    <QueryClientProvider client={localQueries}>
      <AuthContext.Provider value={{
        status: "local", user: localWorkspaceAccounts[localAccount].user, error: null,
        login: async () => false,
        checkSession: async () => {},
        logout: async () => {
          setLocalAccount(null);
          navigate("/auth/login", { replace: true });
        },
      }}>
        <AuthGate><AuthenticatedWorkspace /></AuthGate>
      </AuthContext.Provider>
    </QueryClientProvider>
  );

  return <AuthGate onEnterLocal={canOpenLocalWorkspace() ? enterLocal : undefined}>
    <AuthenticatedWorkspace />
  </AuthGate>;
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceEntry />
    </AuthProvider>
  );
}
