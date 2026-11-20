import { useCallback, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import ThemeToggle from "../components/ui/ThemeToggle";
import LoginGuide from "./LoginGuide";
import LoginOrbit from "./LoginOrbit";
import "./login.css";

export default function AuthLayout() {
  const { pathname, search, hash, state } = useLocation();
  const navigate = useNavigate();
  const guideOpen = hash === "#guide";
  const cardLabel = pathname === "/auth/signup" ? "회원가입" : "로그인";
  const previousView = useRef({ pathname, guideOpen });
  const guideHeading = useRef<HTMLHeadingElement>(null);
  const guideToggle = useRef<HTMLButtonElement>(null);
  const cardFrame = useRef<HTMLDivElement>(null);
  const changeGuide = useCallback((open: boolean) => {
    if (open === guideOpen) return;
    void navigate({ pathname, search, hash: open ? "#guide" : "" }, { state });
  }, [guideOpen, navigate, pathname, search, state]);

  useEffect(() => {
    const previous = previousView.current;
    if (previous.pathname === pathname && previous.guideOpen === guideOpen) return;
    previousView.current = { pathname, guideOpen };
    window.scrollTo(0, 0);
    const focusTarget = guideOpen
      ? guideHeading.current
      : previous.pathname !== pathname
        ? cardFrame.current?.querySelector("h1")
        : guideToggle.current;
    focusTarget?.focus({ preventScroll: true });
  }, [guideOpen, pathname]);

  useEffect(() => {
    if (!guideOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) changeGuide(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [changeGuide, guideOpen]);

  return (
    <div className="login-experience" data-guide-open={guideOpen}>
      <LoginOrbit />
      <header className="login-topbar">
        <Link
          className="login-brand"
          to={{ pathname: "/auth/login", search }}
          state={pathname === "/auth/login" ? state : undefined}
          aria-label="ASTRA 로그인"
        >
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="9" />
            <ellipse cx="20" cy="20" rx="19" ry="6" transform="rotate(-30 20 20)" />
          </svg>
          <span>
            ASTRA
            <small>우주항공 시험장비 공동활용 플랫폼</small>
          </span>
        </Link>
        <div className="login-topbar__actions">
          <ThemeToggle />
          <button ref={guideToggle} type="button" className="login-guide-link"
            aria-controls="login-guide" aria-expanded={guideOpen}
            aria-label={guideOpen ? `${cardLabel}으로 돌아가기` : undefined}
            onClick={() => changeGuide(!guideOpen)}>
            {guideOpen && <ArrowLeft size={15} aria-hidden="true" />}
            {guideOpen ? cardLabel : "이용 안내"}
            {!guideOpen && <ArrowRight size={15} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="login-viewport">
        <div className="login-track">
          <section
            id="login-view"
            className="login-screen"
            aria-hidden={guideOpen}
            aria-labelledby="auth-card-heading"
            ref={(element) => { if (element) element.inert = guideOpen; }}
          >
            <div key={pathname} ref={cardFrame} className="auth-card-frame">
              <Outlet />
            </div>
          </section>
          <LoginGuide open={guideOpen} headingRef={guideHeading} />
        </div>
      </main>

      <footer className="login-footer">
        <span>© 2026 ASTRA</span>
      </footer>
    </div>
  );
}
