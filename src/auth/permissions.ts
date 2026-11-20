const everyone = ["COMPANY_USER", "INSTITUTION_MANAGER", "ADMIN"];
const company = ["COMPANY_USER", "ADMIN"];
export const menuPermissions = {
  home: everyone,
  search: everyone,
  compare: everyone,
  duplicates: everyone,
  chatbot: company,
  assistant: company,
  matching: company,
  autopilot: company,
  reservation: company,
  reservationCheck: everyone,
  calendar: everyone,
  manager: ["INSTITUTION_MANAGER", "ADMIN"],
  review: ["INSTITUTION_MANAGER", "ADMIN"],
  testInfo: everyone,
  simulation: everyone,
  notifications: everyone,
  admin: ["ADMIN"],
};
export const canAccessMenu = (role, menu) =>
  menuPermissions[menu]?.includes(role) === true;
