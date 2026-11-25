import type { User } from "../services/authService";

const everyone = ["COMPANY_USER", "INSTITUTION_MANAGER", "ADMIN"];
// 관리자는 승인·데이터 관리 전용 계정입니다. 장비 검색·시험 업무·AI 상담은 실무 계정(기업·기관·대학)만 사용합니다.
const members = ["COMPANY_USER", "INSTITUTION_MANAGER"];
export const menuPermissions = {
  home: everyone,
  search: members,
  compare: members,
  chatbot: members,
  assistant: members,
  matching: members,
  autopilot: members,
  reservation: members,
  quickRequest: members, // v15: AI 간편 의뢰 (조건 → 장비 → 의뢰서)
  reservationCheck: members,
  calendar: members,
  manager: ["INSTITUTION_MANAGER", "ADMIN"],
  review: ["INSTITUTION_MANAGER"], // v11: 받은 의뢰함은 장비를 가진 기관·대학만
  testInfo: members,
  simulation: members,
  notifications: everyone,
  admin: ["ADMIN"],
  stats: ["ADMIN"],
};
export const canAccessMenu = (role, menu) =>
  menuPermissions[menu]?.includes(role) === true;

export function ownsOrganization(user: User, organizationId?: number | null) {
  return organizationId != null && user.organization?.id === organizationId;
}
