import { useId } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { roleLabels } from "../../domain/constants";
import { useTheme } from "../../theme/useTheme";
import type { User } from "../../services/authService";

/** 프로필 원을 누르면 아래로 펼쳐지는 계정 메뉴. 프로필 정보를 바로 보여줍니다. */
export default function ProfileMenu({ user, onLogout, open, onToggle, onClose }: {
  user: User;
  onLogout: () => Promise<void>;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const menuId = useId();
  const { theme, toggleTheme } = useTheme();
  const role = user.organization?.orgType === "UNIVERSITY" && user.role === "INSTITUTION_MANAGER"
    ? "대학 담당자" : roleLabels[user.role];
  const initial = user.name?.trim().slice(0, 1) || "A";

  return <div className="header-menu header-account">
    <button type="button" className="user-avatar" title="내 계정" aria-label="내 계정 메뉴"
      aria-haspopup="true" aria-expanded={open} aria-controls={menuId} onClick={onToggle}>
      {initial}
    </button>
    <div className="header-dropdown profile-menu" id={menuId} hidden={!open}>
      <div className="profile-menu__head">
        <span className="profile-menu__avatar" aria-hidden="true">{initial}</span>
        <div>
          <strong>{user.name}</strong>
          {user.email && <small>{user.email}</small>}
        </div>
      </div>
      <dl>
        <div><dt>소속</dt><dd>{user.organization?.name || "소속 없음"}</dd></div>
        <div><dt>역할</dt><dd>{role}</dd></div>
        {user.phone && <div><dt>연락처</dt><dd>{user.phone}</dd></div>}
      </dl>
      <div className="profile-menu__actions">
        <button type="button" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          {theme === "dark" ? "라이트 모드로 보기" : "다크 모드로 보기"}
        </button>
        <button type="button" className="is-danger" onClick={() => {
          onClose();
          void onLogout();
        }}>
          <LogOut size={16} aria-hidden="true" />
          로그아웃
        </button>
      </div>
    </div>
  </div>;
}
