import { getData, mutate } from "./http";
import type { User } from "./authService";
import type { NamedResource, Page, ResourceId } from "./contracts";

export interface Organization extends NamedResource {
  orgType: string;
  isVerified: boolean;
  region?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  homepageUrl?: string | null;
  createdAt?: string | null;
}

export interface OrganizationInput {
  orgType?: "INSTITUTION" | "UNIVERSITY";
  name?: string;
  region?: string;
  address?: string;
  phone?: string;
  homepageUrl?: string;
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
  /** 기관·대학 직접 등록 (API 명세: POST /admin/organizations → 바로 승인 상태로 생성) */
  createOrganization: (body: OrganizationInput) => mutate<Organization>("POST", "/admin/organizations", body),
  /** 기관 정보 수정 (API 명세: PATCH /admin/organizations/{id}, 보낸 값만 변경) */
  updateOrganization: (id: ResourceId, body: OrganizationInput) => mutate<Organization>("PATCH", `/admin/organizations/${id}`, body),
};
