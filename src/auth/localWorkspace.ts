import type { User } from "../services/authService";

export const localWorkspaceAccounts = {
  company: {
    label: "기업",
    user: { id: -1, role: "COMPANY_USER", status: "ACTIVE", name: "기업 담당자", email: "",
      organization: { id: -1, name: "기업 업무 화면", orgType: "COMPANY" } },
  },
  institution: {
    label: "기관",
    user: { id: -2, role: "INSTITUTION_MANAGER", status: "ACTIVE", name: "기관 담당자", email: "",
      organization: { id: -2, name: "기관 업무 화면", orgType: "INSTITUTION" } },
  },
  university: {
    label: "대학",
    user: { id: -3, role: "INSTITUTION_MANAGER", status: "ACTIVE", name: "대학 담당자", email: "",
      organization: { id: -3, name: "대학 업무 화면", orgType: "UNIVERSITY" } },
  },
  admin: {
    label: "관리자",
    user: { id: -4, role: "ADMIN", status: "ACTIVE", name: "플랫폼 관리자", email: "", organization: null },
  },
} as const satisfies Record<string, { label: string; user: User }>;

export type LocalWorkspaceAccount = keyof typeof localWorkspaceAccounts;

export function canOpenLocalWorkspace() {
  return import.meta.env.DEV ||
    (typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname));
}
