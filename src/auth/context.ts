import { createContext, useContext } from "react";
import type { ApiError } from "../api/errors";
import type { User } from "../services/authService";

export type AuthState =
  | { status: "authenticated"; user: User; error: null }
  | { status: "checking" | "anonymous" | "error"; user: null; error: ApiError | null };

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider가 필요합니다.");
  return value;
}
