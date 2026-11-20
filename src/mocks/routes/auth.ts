import type { MockRoute } from "../engine";
import { MOCK_PASSWORD } from "../database";
import { ok, pageOf, reject, textRequired, userView } from "../http";

const active = (user) => {
  if (user.status !== "ACTIVE")
    reject(403, "ACCOUNT_NOT_ACTIVE", "이용할 수 없는 계정입니다.", {
      status: user.status,
      rejectReason: user.rejectReason,
    });
};
function session(ctx, user) {
  const record = {
    userId: user.id,
    accessToken: `mock-access-${crypto.randomUUID()}`,
    refreshToken: `mock-refresh-${crypto.randomUUID()}`,
    expiresAt: Date.parse(ctx.now) + 3600000,
    refreshExpiresAt: Date.parse(ctx.now) + 14 * 86400000,
  };
  ctx.state.sessions.push(record);
  user.lastLoginAt = ctx.now;
  return ok({
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    expiresIn: 3600,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    },
  });
}
export function authenticate(ctx) {
  const token = ctx.authorization?.replace(/^Bearer /, "");
  const record = ctx.state.sessions.find((s) => s.accessToken === token);
  if (!record) reject(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
  if (record.expiresAt <= Date.parse(ctx.now))
    reject(401, "TOKEN_EXPIRED", "로그인이 만료되었습니다.");
  const user = ctx.state.users.find((u) => u.id === record.userId);
  if (!user) reject(401, "AUTH_REQUIRED", "계정 정보를 찾을 수 없습니다.");
  active(user);
  ctx.user = user;
  ctx.session = record;
}
export const authRoutes: MockRoute[] = [
  [
    "POST",
    "/auth/login",
    (ctx) => {
      const email = textRequired(ctx.body.email, "이메일", 254).toLowerCase();
      const user = ctx.state.users.find((u) => u.email.toLowerCase() === email);
      if (!user || ctx.body.password !== MOCK_PASSWORD)
        reject(
          401,
          "INVALID_CREDENTIALS",
          "이메일 또는 비밀번호를 확인해주세요.",
        );
      active(user);
      return session(ctx, user);
    },
  ],
  [
    "POST",
    "/auth/refresh",
    (ctx) => {
      const old = ctx.state.sessions.find(
        (s) => s.refreshToken === ctx.body.refreshToken,
      );
      if (!old || old.refreshExpiresAt <= Date.parse(ctx.now))
        reject(401, "TOKEN_EXPIRED", "시연 세션이 만료되었습니다.");
      const user = ctx.state.users.find((u) => u.id === old.userId);
      active(user);
      ctx.state.sessions = ctx.state.sessions.filter((s) => s !== old);
      return session(ctx, user);
    },
  ],
  [
    "POST",
    "/auth/logout",
    (ctx) => {
      textRequired(ctx.body.refreshToken, "refresh 토큰");
      ctx.state.sessions = ctx.state.sessions.filter(
        (s) => s.accessToken !== ctx.session.accessToken,
      );
      return ok(null);
    },
  ],
  ["GET", "/users/me", (ctx) => ok(userView(ctx.state, ctx.user))],
  [
    "PATCH",
    "/users/me",
    (ctx) => {
      for (const key of ["name", "phone"])
        if (ctx.body[key] !== undefined)
          ctx.user[key] = textRequired(ctx.body[key], key, 200);
      return ok(userView(ctx.state, ctx.user));
    },
  ],
  [
    "GET",
    "/auth/institutions",
    (ctx) =>
      ok(
        ctx.state.organizations
          .filter((o) => o.orgType === "INSTITUTION" && o.isVerified)
          .map(({ id, name, region }) => ({ id, name, region })),
      ),
  ],
  [
    "GET",
    "/admin/users",
    (ctx) => {
      ctx.role();
      return ok(
        pageOf(
          ctx.state.users
            .filter(
              (u) =>
                (!ctx.url.searchParams.get("status") ||
                  u.status === ctx.url.searchParams.get("status")) &&
                (!ctx.url.searchParams.get("role") ||
                  u.role === ctx.url.searchParams.get("role")),
            )
            .map((u) => userView(ctx.state, u)),
          ctx.url,
        ),
      );
    },
  ],
  [
    "POST",
    "/admin/users/:id/approve",
    (ctx) => {
      ctx.role();
      const user =
        ctx.state.users.find((u) => u.id === Number(ctx.params.id)) ??
        reject(404, "NOT_FOUND", "회원을 찾을 수 없습니다.");
      if (user.status !== "PENDING")
        reject(409, "CONFLICT", "승인 대기 회원만 승인할 수 있습니다.");
      user.status = "ACTIVE";
      user.rejectReason = null;
      user.approvedAt = ctx.now;
      const org = ctx.state.organizations.find(
        (o) => o.id === user.organizationId,
      );
      if (org) org.isVerified = true;
      return ok(userView(ctx.state, user));
    },
  ],
  [
    "POST",
    "/admin/users/:id/reject",
    (ctx) => {
      ctx.role();
      const user =
        ctx.state.users.find((u) => u.id === Number(ctx.params.id)) ??
        reject(404, "NOT_FOUND", "회원을 찾을 수 없습니다.");
      if (user.status !== "PENDING")
        reject(409, "CONFLICT", "승인 대기 회원만 거절할 수 있습니다.");
      user.rejectReason = textRequired(ctx.body.reason, "거절 사유", 1000);
      user.status = "REJECTED";
      return ok(userView(ctx.state, user));
    },
  ],
  [
    "PATCH",
    "/admin/users/:id/status",
    (ctx) => {
      ctx.role();
      const user =
        ctx.state.users.find((u) => u.id === Number(ctx.params.id)) ??
        reject(404, "NOT_FOUND", "회원을 찾을 수 없습니다.");
      if (
        !["ACTIVE", "SUSPENDED"].includes(ctx.body.status) ||
        !["ACTIVE", "SUSPENDED"].includes(user.status) ||
        user.id === ctx.user.id
      )
        reject(409, "CONFLICT", "활성·정지 회원의 상태만 변경할 수 있습니다.");
      user.status = ctx.body.status;
      return ok(userView(ctx.state, user));
    },
  ],
  [
    "GET",
    "/admin/organizations",
    (ctx) => {
      ctx.role();
      return ok(
        pageOf(
          ctx.state.organizations.filter(
            (o) =>
              (!ctx.url.searchParams.get("orgType") ||
                o.orgType === ctx.url.searchParams.get("orgType")) &&
              (!ctx.url.searchParams.has("verified") ||
                o.isVerified ===
                  (ctx.url.searchParams.get("verified") === "true")),
          ),
          ctx.url,
        ),
      );
    },
  ],
  [
    "POST",
    "/admin/organizations/:id/verify",
    (ctx) => {
      ctx.role();
      const org =
        ctx.state.organizations.find((o) => o.id === Number(ctx.params.id)) ??
        reject(404, "NOT_FOUND", "기관을 찾을 수 없습니다.");
      org.isVerified = true;
      return ok(org);
    },
  ],
];
