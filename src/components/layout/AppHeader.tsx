import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "../../auth/context";
import ProfileMenu from "./ProfileMenu";
import NotificationMenu from "./NotificationMenu";
import QuickSearch from "./QuickSearch";
import { HEADER_SLOT_ID, ViewSwitch } from "./HeaderSlot";
import type { SearchSuggestion } from "./QuickSearch";
import type { NotificationTarget } from "../../domain/notificationTarget";
import type { DashboardView } from "../../services/dashboardService";

export default function AppHeader({ activeMenu, menuOpen, onMenu, onSearch, searchSources, searchRecommendations, onNotifications, onOpenTarget, dashboardView, onDashboardView }: {
  activeMenu: string;
  menuOpen: boolean;
  onMenu: () => void;
  onSearch: (query: string, options?: SearchSuggestion["options"]) => void;
  searchSources: SearchSuggestion[];
  searchRecommendations?: SearchSuggestion[];
  onNotifications: () => void;
  onOpenTarget: (target: NotificationTarget) => void;
  /** 기관 담당자: 대시보드 '장비 운영 / 내 의뢰' 전환 (대시보드에서만 표시) */
  dashboardView?: DashboardView;
  onDashboardView?: (view: DashboardView) => void;
}) {
  const { user, logout } = useAuth();
  const admin = user.role === "ADMIN";
  const tools = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<"profile" | "notifications" | null>(null);
  const toggle = (next: "profile" | "notifications") => setPanel((current) => (current === next ? null : next));
  const close = () => setPanel(null);

  // 바깥을 누르거나 Esc 를 누르면 펼친 메뉴를 닫습니다.
  useEffect(() => {
    if (!panel) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !tools.current?.contains(event.target)) setPanel(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setPanel(null); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);

  return (
    <header className="app-header">
      <div className="app-header__location">
        <button
          className="icon-button mobile-menu"
          onClick={onMenu}
          aria-label="메뉴 열기"
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
        >
          <Menu size={21} />
        </button>
        {/* v9: 화면 이름은 지우고, 화면별 전환 버튼만 이 자리에 둡니다. */}
        <div id={HEADER_SLOT_ID} className="app-header__slot">
          {activeMenu === "home" && user.role === "INSTITUTION_MANAGER" && dashboardView && onDashboardView && (
            <ViewSwitch label="대시보드 업무 범위" value={dashboardView} onChange={onDashboardView}
              options={[{ value: "PROVIDER", label: "장비 운영", title: "받은 의뢰와 보유 장비 일정" }, { value: "REQUESTER", label: "내 의뢰", title: "우리 기관이 다른 곳에 보낸 의뢰" }]} />
          )}
        </div>
      </div>

      <QuickSearch userId={user.id} sources={searchSources} recommendations={searchRecommendations} onSearch={onSearch}
        placeholder={admin ? "회원 이름, 이메일, 기관명 검색" : "장비명, 시험 종류, 기관명 검색"} />

      <div className="app-header__tools" ref={tools}>
        <NotificationMenu userId={user.id} role={user.role} open={panel === "notifications"}
          onToggle={() => toggle("notifications")} onClose={close} onOpenTarget={onOpenTarget} onShowAll={onNotifications} />
        <ProfileMenu user={user} onLogout={logout} open={panel === "profile"} onToggle={() => toggle("profile")} onClose={close} />
      </div>
    </header>
  );
}
