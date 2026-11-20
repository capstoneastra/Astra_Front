import { contractError } from "../api/errors";

export const USER_ROLES = ["COMPANY_USER", "INSTITUTION_MANAGER", "ADMIN"] as const;
export type UserRole = typeof USER_ROLES[number];

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: number; name: string; role: UserRole; organizationId?: number | null };
}

export function validateSession(session: AuthSession | undefined): AuthSession {
  if (
    typeof session?.accessToken !== "string" || !session.accessToken.trim() ||
    typeof session.refreshToken !== "string" || !session.refreshToken.trim() ||
    !Number.isSafeInteger(session.expiresIn) || session.expiresIn <= 0 ||
    !Number.isSafeInteger(session.user?.id) ||
    typeof session.user.name !== "string" ||
    !USER_ROLES.includes(session.user.role) ||
    (session.user.organizationId != null && !Number.isSafeInteger(session.user.organizationId))
  )
    throw contractError("로그인 또는 토큰 재발급 응답이 인증 명세와 다릅니다.");
  return session;
}
