import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "../auth/context";
import { ApiError } from "../api/errors";
import { queryClient } from "../api/cache";
import { clearDemoSession, demoAccounts, DEMO_PASSWORD, readDemoUser, writeDemoSession } from "./session";
import { withDemoProfile } from "./profiles";
export default function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(readDemoUser);
  const [error, setError] = useState<ApiError | null>(null);
  const checkSession = async () => { const next = readDemoUser(); setUser(next); if (!next) queryClient.clear(); };
  useEffect(() => {
    const timer = setInterval(() => { if (!readDemoUser()) { setUser(null); queryClient.clear(); } }, 30000);
    return () => clearInterval(timer);
  }, []);
  return <AuthContext.Provider value={{ ...(user ? { status: "authenticated" as const, user, error: null } : { status: "anonymous" as const, user: null, error }),
    checkSession,
    login: async (email, password) => {
      const account = demoAccounts.find(a => a.email === email.trim().toLowerCase());
      if (!account || password !== DEMO_PASSWORD) { setError(new ApiError("DEMO 이메일 또는 비밀번호를 확인해주세요.", { status: 401, code: "INVALID_CREDENTIALS" })); return false; }
      if (withDemoProfile(account.user).status !== "ACTIVE") { setError(new ApiError("승인 대기·거절·정지 상태의 계정입니다. 관리자에게 문의해주세요.", { status: 403, code: "ACCOUNT_NOT_ACTIVE" })); return false; }
      try { writeDemoSession(account.email); } catch { setError(new ApiError("브라우저에서 DEMO 세션을 저장할 수 없습니다. 저장소 허용 상태를 확인해주세요.")); return false; }
      queryClient.clear(); setError(null); setUser(readDemoUser()); return true;
    },
    logout: async () => { clearDemoSession(); queryClient.clear(); setError(null); setUser(null); window.location.replace("/auth/login"); },
  }}>{children}</AuthContext.Provider>;
}
