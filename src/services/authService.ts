import { apiClient, responseData } from "../api/client";
import { contractError } from "../api/errors";
import { tokenStore } from "../auth/tokenStore";

export const USER_ROLES = ["COMPANY_USER", "INSTITUTION_MANAGER", "ADMIN"] as const;
export type UserRole = typeof USER_ROLES[number];

export interface User {
  id: number;
  role: UserRole;
  status: string;
  name: string;
  email: string;
  organization?: { id: number; name: string; isVerified?: boolean } | null;
}

interface LoginSession {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn: number;
}

export function validateUser(user: User | undefined): User {
  if (
    !user ||
    !Number.isSafeInteger(user.id) ||
    !USER_ROLES.includes(user.role) ||
    typeof user.status !== "string" ||
    typeof user.name !== "string" ||
    typeof user.email !== "string"
  )
    throw contractError("사용자 응답의 id·role·status가 명세와 다릅니다.");
  if (
    user.organization !== null &&
    user.organization !== undefined &&
    (!Number.isSafeInteger(user.organization.id) ||
      typeof user.organization.name !== "string")
  )
    throw contractError("사용자 소속 조직 응답을 확인해주세요.");
  return user;
}

export const authService = {
  async logout(refreshToken: string) {
    return responseData(
      await apiClient.post(
        "/auth/logout",
        { refreshToken },
        {
          authToken: tokenStore.getToken(),
          sessionVersion: tokenStore.getVersion(),
        },
      ),
    );
  },
  async login(email: string, password: string, signal?: AbortSignal) {
    const data = responseData<LoginSession>(
      await apiClient.post(
        "/auth/login",
        { email, password },
        { requiresAuth: false, signal },
      ),
    );
    if (
      typeof data?.accessToken !== "string" ||
      !data.accessToken ||
      !Number.isFinite(data.expiresIn) ||
      data.expiresIn <= 0
    )
      throw contractError(
        "로그인 응답에 유효한 accessToken·expiresIn이 없습니다.",
      );
    return data;
  },
  async me(signal?: AbortSignal) {
    return validateUser(
      responseData<User>(await apiClient.get("/users/me", { signal })),
    );
  },
};
