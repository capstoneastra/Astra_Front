import { useEffect } from "react";
import { useAuth } from "./context";
import LoginPage from "./LoginPage";
import ApiState from "../components/ui/ApiState";
import { Button, Panel } from "../components/ui";

export default function AuthGate({ children }) {
  const { status, error, checkSession, logout } = useAuth();
  useEffect(() => {
    const syncPath = () => {
      if (status === "anonymous" && window.location.pathname !== "/auth/login")
        window.history.replaceState(null, "", "/auth/login");
      if (
        status === "authenticated" &&
        window.location.pathname.startsWith("/auth/")
      )
        window.history.replaceState(null, "", "/");
    };
    syncPath();
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, [status]);
  if (status === "anonymous") return <LoginPage />;
  if (status !== "authenticated")
    return (
      <main className="main-content">
        <div className="content-page content-page--narrow">
          <Panel className="form-panel">
            <ApiState
              loading={status === "checking"}
              error={error}
              onRetry={checkSession}
            />
            {status === "error" && (
              <Button variant="secondary" onClick={logout}>
                로그인 화면으로
              </Button>
            )}
          </Panel>
        </div>
      </main>
    );
  return children;
}
