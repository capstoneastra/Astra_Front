import type { MockRoute } from "../mocks/engine";
import { ok, pageOf, reject } from "../mocks/http";
import { previewUsers } from "./user";

export function createPreviewAdminRoutes(): MockRoute[] {
  const members = Object.values(previewUsers).map((user) => ({ ...user }));
  return [
    ["GET", "/admin/users", (ctx) => {
      ctx.role();
      const status = ctx.url.searchParams.get("status");
      return ok(pageOf(members.filter((member) => !status || member.status === status), ctx.url));
    }],
    ["PATCH", "/admin/users/:id/status", (ctx) => {
      ctx.role();
      const member = members.find((item) => item.id === Number(ctx.params.id));
      if (!member) reject(404, "NOT_FOUND", "시연 회원을 찾을 수 없습니다.");
      const status = ctx.body.status;
      if (member.role === "ADMIN" || !["ACTIVE", "SUSPENDED"].includes(status))
        reject(409, "USER_INVALID_STATUS", "시연 회원의 상태를 변경할 수 없습니다.");
      member.status = status;
      return ok(member);
    }],
    ["GET", "/admin/organizations", (ctx) => {
      ctx.role();
      return ok(pageOf(ctx.state.organizations, ctx.url));
    }],
  ];
}
