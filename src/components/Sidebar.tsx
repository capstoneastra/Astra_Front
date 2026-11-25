import { useEffect, useRef } from "react";
import { ArrowUpRight, Orbit, X } from "lucide-react";
import { navigation } from "../data/navigation";
import { useAuth } from "../auth/context";
import { canAccessMenu } from "../auth/permissions";
import { roleLabels } from "../domain/constants";
import { useWorkspace } from "../context/AppContext";

export default function Sidebar({
  activeMenu,
  setActiveMenu,
  open,
  onClose,
  blocked = false,
}) {
  const sidebar = useRef<HTMLElement>(null);
  const { user } = useAuth();
  const { workspaceView, setWorkspaceView } = useWorkspace();
  const visible = workspaceView === "ADMIN" ? ["home","admin","manager","review","duplicates","calendar","notifications","settings"]
    : workspaceView === "PROVIDER" ? ["home","manager","review","calendar","duplicates","notifications","settings"]
    : ["home","search","reservation","reservationCheck","calendar","assistant","notifications","settings"];
  const visibleNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessMenu(user.role, item.id) && visible.includes(item.id)).map(item => item.id === "review" ? { ...item, label: user.role === "ADMIN" ? "시험 운영 관리" : "접수 의뢰·검토" } : item.id === "manager" ? { ...item, label: user.role === "ADMIN" ? "전체 장비 관리" : "보유 장비 관리" } : item),
    }))
    .filter((group) => group.items.length);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const element = sidebar.current;
    element.querySelector("button").focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = [
        ...element.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      ].filter((item) => item.getClientRects().length);
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      const returnFocus =
        previous === document.body
          ? document.querySelector(".mobile-menu")
          : previous;
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, [open, onClose]);

  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="메뉴 닫기"
          tabIndex={-1}
          onClick={onClose}
        />
      )}
      <aside
        ref={(node) => {
          sidebar.current = node;
          if (node) node.inert = blocked;
        }}
        id="primary-navigation"
        className={`sidebar ${open ? "sidebar--open" : ""}`}
        aria-label="주 메뉴"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
      >
        <div className="sidebar__brand-row">
          <button
            className="brand"
            onClick={() => setActiveMenu("home")}
            aria-label="ASTRA 대시보드"
          >
            <span className="brand__mark">
              <Orbit size={28} strokeWidth={1.4} aria-hidden="true" />
            </span>
            <span className="brand__text">
              ASTRA<span>AEROSPACE INFRASTRUCTURE</span>
            </span>
          </button>
          <button
            className="icon-button sidebar__close"
            aria-label="메뉴 닫기"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-label__icon">A</span>
          <div>
            시험장비 공동활용<span>통합 워크스페이스</span>
          </div>
          <span className="workspace-label__dot" />
        </div>
        {user.role !== "ADMIN" && <div className="workspace-switch" aria-label="업무 공간 선택"><button type="button" aria-pressed={workspaceView === "REQUESTER"} onClick={() => setWorkspaceView("REQUESTER")}>장비 이용</button><button type="button" aria-pressed={workspaceView === "PROVIDER"} onClick={() => setWorkspaceView("PROVIDER")}>장비 제공</button></div>}
        <nav className="sidebar__nav" aria-label="서비스 메뉴">
          {visibleNavigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group__label">{group.label}</p>
              {group.items.map(({ id, label, icon: Icon, upcoming }) => (
                <button
                  key={id}
                  disabled={upcoming}
                  onClick={() => setActiveMenu(id)}
                  className={`nav-item ${activeMenu === id ? "nav-item--active" : ""}`}
                  aria-current={
                    activeMenu === id && id !== "assistant" ? "page" : undefined
                  }
                  aria-expanded={
                    id === "assistant" ? activeMenu === id : undefined
                  }
                  aria-controls={
                    id === "assistant" ? "astra-ai-assistant" : undefined
                  }
                  aria-label={upcoming ? `${label} · 준비 중` : label}
                  title={upcoming ? `${label} · 후속 구현 예정` : label}
                >
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                  <span>{label}</span>
                  {upcoming && <small>예정</small>}
                  {id === "assistant" && (
                    <small className="nav-item__ai">AI</small>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar__bottom">
          {workspaceView === "REQUESTER" && canAccessMenu(user.role, "assistant") && (
            <button
              className="sidebar-assistant"
              onClick={() => setActiveMenu("assistant")}
            >
              <span>
                <Orbit size={19} />
                ASTRA AI 열기
              </span>
              <p>시험 상담 · 자동 추진</p>
              <ArrowUpRight size={15} className="sidebar-assistant__arrow" />
            </button>
          )}
          <div className="sidebar__footer">
            <span className="status-dot" />
            {roleLabels[user.role] ?? user.role}
            <span>v0.1</span>
          </div>
        </div>
      </aside>
    </>
  );
}
