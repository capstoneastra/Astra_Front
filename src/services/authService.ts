import { apiClient, responseData } from "../api/client";
import { contractError } from "../api/errors";
import { USER_ROLES, validateSession } from "../auth/session";
import type { AuthSession, UserRole } from "../auth/session";

export { USER_ROLES } from "../auth/session";
export type { UserRole } from "../auth/session";

export interface User {
  id: number;
  role: UserRole;
  status: string;
  name: string;
  email: string;
  phone?: string | null;
  organization?: { id: number; name: string; isVerified?: boolean; orgType?: "COMPANY" | InstitutionType } | null;
}

export type InstitutionType = "INSTITUTION" | "UNIVERSITY";
export interface SignupInstitution {
  id: number;
  orgType: InstitutionType;
  name: string;
  region?: string | null;
}

interface Applicant {
  email: string;
  password: string;
  name: string;
  phone?: string;
  verificationToken: string;
}

export type SignupRequest = Applicant & (
  | { role: "COMPANY_USER"; organization: { name: string; businessRegNo: string } }
  | { role: "INSTITUTION_MANAGER"; researcherNo: string; organizationId: number }
  | { role: "INSTITUTION_MANAGER"; researcherNo: string; organization: { orgType: InstitutionType; name: string; address: string; phone: string } }
);

const publicPost = async <T>(path: string, body: object, signal?: AbortSignal) =>
  responseData<T>(await apiClient.post(path, body, { requiresAuth: false, signal }));
const isDuration = (value: number) => Number.isSafeInteger(value) && value > 0;

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
  logout: () => apiClient.revokeSession(),
  async login(email: string, password: string, signal?: AbortSignal) {
    return validateSession(
      await publicPost<AuthSession>("/auth/login", { email, password }, signal),
    );
  },
  async sendVerification(email: string, signal?: AbortSignal) {
    const data = await publicPost<{ expiresIn: number; resendAvailableIn: number }>(
      "/auth/email-verifications", { email }, signal,
    );
    if (!isDuration(data?.expiresIn) || !Number.isSafeInteger(data.resendAvailableIn) || data.resendAvailableIn < 0)
      throw contractError("인증 코드 발송 응답의 유효 시간을 확인할 수 없습니다.");
    return data;
  },
  async confirmVerification(email: string, code: string, signal?: AbortSignal) {
    const data = await publicPost<{ verificationToken: string; expiresIn: number }>(
      "/auth/email-verifications/confirm", { email, code }, signal,
    );
    if (typeof data?.verificationToken !== "string" || !data.verificationToken.trim() || !isDuration(data.expiresIn))
      throw contractError("이메일 인증 응답에서 유효한 가입 토큰을 확인할 수 없습니다.");
    return data;
  },
  async signup(request: SignupRequest, signal?: AbortSignal) {
    const data = await publicPost<{ userId: number; status: "PENDING" }>("/auth/signup", request, signal);
    if (!Number.isSafeInteger(data?.userId) || data.userId <= 0 || data.status !== "PENDING")
      throw contractError("가입 신청 결과를 확인할 수 없습니다.");
    return data;
  },
  async institutions(signal?: AbortSignal) {
    const data = responseData<SignupInstitution[]>(
      await apiClient.get("/auth/institutions", { requiresAuth: false, signal }),
    );
    if (!Array.isArray(data) || data.some((item) =>
      !Number.isSafeInteger(item?.id) || item.id <= 0 ||
      !["INSTITUTION", "UNIVERSITY"].includes(item.orgType) ||
      typeof item.name !== "string" ||
      (item.region != null && typeof item.region !== "string")
    ))
      throw contractError("가입용 기관·대학 목록의 응답 형식이 명세와 다릅니다.");
    return data;
  },
  // ── 계정 찾기 (v17, docs/api-spec.md 1-1) ──
  /** 이름·연락처로 가입한 이메일(아이디)을 찾습니다. 서버는 가려진 이메일만 돌려줍니다. */
  async findEmail(name: string, phone: string, signal?: AbortSignal) {
    const data = await publicPost<{ emails: string[] }>("/auth/find-email", { name, phone }, signal);
    if (!Array.isArray(data?.emails) || data.emails.some((item) => typeof item !== "string"))
      throw contractError("이메일 찾기 응답 형식이 명세와 다릅니다.");
    return data.emails;
  },
  /** 비밀번호 재설정 코드 발송. 가입하지 않은 이메일이어도 같은 응답을 받습니다. */
  async sendPasswordReset(email: string, signal?: AbortSignal) {
    const data = await publicPost<{ expiresIn: number; resendAvailableIn: number }>("/auth/password-resets", { email }, signal);
    if (!isDuration(data?.expiresIn) || !Number.isSafeInteger(data.resendAvailableIn) || data.resendAvailableIn < 0)
      throw contractError("재설정 코드 발송 응답의 유효 시간을 확인할 수 없습니다.");
    return data;
  },
  async confirmPasswordReset(email: string, code: string, signal?: AbortSignal) {
    const data = await publicPost<{ resetToken: string; expiresIn: number }>("/auth/password-resets/confirm", { email, code }, signal);
    if (typeof data?.resetToken !== "string" || !data.resetToken.trim() || !isDuration(data.expiresIn))
      throw contractError("재설정 코드 확인 응답에서 토큰을 확인할 수 없습니다.");
    return data;
  },
  async completePasswordReset(resetToken: string, newPassword: string, signal?: AbortSignal) {
    await publicPost("/auth/password-resets/complete", { resetToken, newPassword }, signal);
  },
  async me(signal?: AbortSignal) {
    return validateUser(
      responseData<User>(await apiClient.get("/users/me", { signal })),
    );
  },
};
