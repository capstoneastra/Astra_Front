import type { User } from "../services/authService";

const everyone = ["COMPANY_USER", "INSTITUTION_MANAGER", "ADMIN"];
export const menuPermissions = {
  home: everyone,
  search: everyone,
  compare: everyone,
  duplicates: everyone,
  chatbot: everyone,
  assistant: everyone,
  matching: everyone,
  autopilot: everyone,
  reservation: everyone,
  reservationCheck: everyone,
  calendar: everyone,
  manager: ["INSTITUTION_MANAGER", "ADMIN"],
  review: everyone,
  testInfo: everyone,
  simulation: everyone,
  notifications: everyone,
  admin: ["ADMIN"],
};
export const canAccessMenu = (role, menu) =>
  menuPermissions[menu]?.includes(role) === true;

export function ownsOrganization(user: User, organizationId?: number | null) {
  return organizationId != null && user.organization?.id === organizationId;
}
