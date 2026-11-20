import type { User } from "../services/authService";
import type { PreviewAccount } from "./paths";

export const previewUsers: Record<PreviewAccount, User> = {
  company: {
    id: 2,
    role: "COMPANY_USER",
    status: "ACTIVE",
    name: "기업 미리보기",
    email: "company-preview@example.invalid",
    organization: { id: 10, name: "가상 A기업", isVerified: true },
  },
  institution: {
    id: 3,
    role: "INSTITUTION_MANAGER",
    status: "ACTIVE",
    name: "기관 미리보기",
    email: "institution-preview@example.invalid",
    organization: { id: 2, name: "대전테크노파크 우주·양자산업센터", isVerified: true },
  },
  university: {
    id: 4,
    role: "INSTITUTION_MANAGER",
    status: "ACTIVE",
    name: "대학 미리보기",
    email: "university-preview@example.invalid",
    organization: { id: 5, name: "경상국립대학교 첨단소재분석지원센터", isVerified: true },
  },
  admin: {
    id: 1,
    role: "ADMIN",
    status: "ACTIVE",
    name: "관리자 미리보기",
    email: "admin-preview@example.invalid",
    organization: null,
  },
};
