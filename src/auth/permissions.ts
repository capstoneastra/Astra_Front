const everyone = ["COMPANY_USER", "INSTITUTION_MANAGER", "ADMIN"];
const company = ["COMPANY_USER", "INSTITUTION_MANAGER"];
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
  manager: everyone,
  review: everyone,
  testInfo: everyone,
  simulation: everyone,
  notifications: everyone,
  settings: everyone,
  admin: ["ADMIN"],
};
export const canAccessMenu = (role, menu) =>
  menuPermissions[menu]?.includes(role) === true;
