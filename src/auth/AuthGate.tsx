import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./context";
import AuthLayout from "./AuthLayout";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import RecoverPage from "./RecoverPage";
import ApiState from "../components/ui/ApiState";
import { Button, Panel } from "../components/ui";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { status, error, checkSession, logout } = useAuth();
  if (status === "anonymous")
    return (
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />
          <Route path="/auth/recover" element={<RecoverPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    );
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
  return (
    <Routes>
      <Route path="/" element={children} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
