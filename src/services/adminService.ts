import { getData, mutate } from "./http";
import type { User } from "./authService";
import type { NamedResource, Page, ResourceId } from "./contracts";

interface Organization extends NamedResource {
  orgType: string;
  isVerified: boolean;
}

export const adminService = {
  users: (params: object = {}, signal?: AbortSignal) =>
    getData<Page<User>>("/admin/users", { size: 100, ...params }, signal),
  approve: (id: ResourceId) => mutate("POST", `/admin/users/${id}/approve`, {}),
  reject: (id: ResourceId, reason: string) =>
    mutate("POST", `/admin/users/${id}/reject`, { reason }),
  status: (id: ResourceId, status: string) =>
    mutate("PATCH", `/admin/users/${id}/status`, { status }),
  organizations: (params: object = {}, signal?: AbortSignal) =>
    getData<Page<Organization>>("/admin/organizations", { size: 100, ...params }, signal),
  verify: (id: ResourceId) => mutate("POST", `/admin/organizations/${id}/verify`, {}),
};
