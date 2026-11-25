import { getData, mutate } from "./http";
import type { User } from "./authService";
import type { NamedResource, Page, ResourceId } from "./contracts";
import { contractError } from "../api/errors";

interface Organization extends NamedResource {
  orgType: string;
  isVerified: boolean;
}
interface AdminUser extends User { createdAt?: string | null; lastLoginAt?: string | null }

export const adminService = {
  async allOrganizations(signal?: AbortSignal) {
    const items: Organization[] = [];
    let page = 0, pages: number;
    do {
      signal?.throwIfAborted();
      const result = await getData<Page<Organization>>("/admin/organizations", { page, size: 100 }, signal);
      if (!Array.isArray(result?.content) || !Number.isSafeInteger(result.totalPages) || result.totalPages < 0 || result.totalPages > 1000 ||
        result.content.some(row => !Number.isSafeInteger(row?.id) || typeof row.name !== "string" || typeof row.orgType !== "string" || typeof row.isVerified !== "boolean"))
        throw contractError("조직 목록과 페이지 정보를 확인해주세요.");
      items.push(...result.content); pages = result.totalPages; page++;
    } while (page < pages);
    return items;
  },
  users: (params: object = {}, signal?: AbortSignal) =>
    getData<Page<AdminUser>>("/admin/users", { size: 100, ...params }, signal),
  approve: (id: ResourceId) => mutate("POST", `/admin/users/${id}/approve`, {}),
  reject: (id: ResourceId, reason: string) =>
    mutate("POST", `/admin/users/${id}/reject`, { reason }),
  status: (id: ResourceId, status: string) =>
    mutate("PATCH", `/admin/users/${id}/status`, { status }),
  organizations: (params: object = {}, signal?: AbortSignal) =>
    getData<Page<Organization>>("/admin/organizations", { size: 100, ...params }, signal),
  verify: (id: ResourceId) => mutate("POST", `/admin/organizations/${id}/verify`, {}),
};
