import type { MockRoute } from "./engine";
import { ok, pageOf, reject } from "./http";
import { demoAccounts } from "./session";
import { saveDemoProfile, setDemoMemberStatus, withDemoProfile } from "./profiles";

export function createPreviewAdminRoutes(): MockRoute[] {
  const members = demoAccounts.map(({ user, email }) => ({ ...user, email }));
  return [
    ["GET", "/users/me", ctx => ok(withDemoProfile(ctx.user))],
    ["PATCH", "/users/me", ctx => ok(saveDemoProfile(ctx.user, ctx.body))],
    ["GET", "/admin/users", (ctx) => {
      ctx.role();
      const status = ctx.url.searchParams.get("status");
      const role = ctx.url.searchParams.get("role");
      return ok(pageOf(members.map(withDemoProfile).filter(member => (!status || member.status === status) && (!role || member.role === role)), ctx.url));
    }],
    ["PATCH", "/admin/users/:id/status", (ctx) => {
      ctx.role();
      const member = members.find((item) => item.id === Number(ctx.params.id));
      if (!member) reject(404, "NOT_FOUND", "시연 회원을 찾을 수 없습니다.");
      const status = ctx.body.status;
      if (member.role === "ADMIN" || !["ACTIVE", "SUSPENDED"].includes(status))
        reject(409, "USER_INVALID_STATUS", "시연 회원의 상태를 변경할 수 없습니다.");
      return ok(setDemoMemberStatus(member, status));
    }],
    ["GET", "/admin/organizations", (ctx) => {
      ctx.role();
      return ok(pageOf(ctx.state.organizations, ctx.url));
    }],
    ["POST", "/admin/organizations/:id/verify", ctx => {
      ctx.role();
      const org = ctx.state.organizations.find(item => item.id === Number(ctx.params.id));
      if (!org) reject(404, "NOT_FOUND", "조직을 찾을 수 없습니다.");
      if (!["INSTITUTION", "UNIVERSITY"].includes(org.orgType)) reject(409, "INVALID_STATUS", "기관·대학만 승인할 수 있습니다.");
      org.isVerified = true;
      return ok(org);
    }],
  ];
}
