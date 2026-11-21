import { useEffect, useId, useRef, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { roleLabels } from "../../domain/constants";
import type { User } from "../../services/authService";

export default function ProfileMenu({ user, onLogout }: {
  user: User;
  onLogout: () => Promise<void>;
}) {
  const [panel, setPanel] = useState<"menu" | "profile" | null>(null);
  const menuId = useId();
  const profileId = useId();
  const account = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const open = panel !== null;
  const showingProfile = panel === "profile";
  const role = user.organization?.orgType === "UNIVERSITY" && user.role === "INSTITUTION_MANAGER"
    ? "대학 담당자" : roleLabels[user.role];

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !account.current?.contains(event.target)) setPanel(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return <div className="header-account" ref={account}
    onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setPanel(null);
    }}
    onKeyDown={(event) => {
      if (event.key !== "Escape" || !open) return;
      event.stopPropagation();
      setPanel(null);
      trigger.current?.focus();
    }}>
    <button type="button" ref={trigger} className="user-avatar" title="계정 메뉴" aria-label="계정 메뉴"
      aria-expanded={open} aria-controls={menuId} onClick={() => setPanel(open ? null : "menu")}>
      {user.name?.slice(0, 1) || "A"}
    </button>
    <div className="header-account__panel" id={menuId} hidden={!open}>
      <div className="header-account__actions">
        <button type="button" className="header-account__action" aria-expanded={showingProfile} aria-controls={profileId}
          onClick={() => setPanel(showingProfile ? "menu" : "profile")}>
          <UserRound size={16} aria-hidden="true" />
          {showingProfile ? "프로필 접기" : "프로필 보기"}
        </button>
        <button type="button" className="header-account__action header-account__action--logout" onClick={() => {
          setPanel(null);
          void onLogout();
        }}>
          <LogOut size={16} aria-hidden="true" />
          로그아웃
        </button>
      </div>
      <dl id={profileId} className="header-account__profile" hidden={!showingProfile}>
        <div><dt>이름</dt><dd>{user.name}</dd></div>
        {user.email && <div><dt>이메일</dt><dd>{user.email}</dd></div>}
        <div><dt>소속</dt><dd>{user.organization?.name || "소속 없음"}</dd></div>
        <div><dt>역할</dt><dd>{role}</dd></div>
        {user.phone && <div><dt>연락처</dt><dd>{user.phone}</dd></div>}
      </dl>
    </div>
  </div>;
}
