import { Link, Outlet, useLocation } from "react-router";
import ThemeToggle from "../components/ui/ThemeToggle";
import AstraBrand from "../components/ui/AstraBrand";
import LoginOrbit from "./LoginOrbit";

// v9: 로그인 화면의 '이용 안내' 버튼과 안내 화면을 삭제했습니다.
export default function AuthLayout() {
  const { pathname, search, state } = useLocation();

  return (
    <div className="login-experience">
      <LoginOrbit />
      <header className="login-topbar">
        <Link
          className="login-brand"
          to={{ pathname: "/auth/login", search }}
          state={pathname === "/auth/login" ? state : undefined}
          aria-label="ASTRA 로그인"
        >
          <AstraBrand />
        </Link>
        <div className="login-topbar__actions">
          <ThemeToggle />
        </div>
      </header>

      <main className="login-viewport">
        <section id="login-view" className="login-screen" aria-labelledby="auth-card-heading">
          <div key={pathname} className="auth-card-frame">
            <Outlet />
          </div>
        </section>
      </main>

      <footer className="login-footer">
        <span>© 2026 ASTRA</span>
      </footer>
    </div>
  );
}
