import type { User } from "../services/authService";
import type { RequestContent } from "../services/contracts";

export interface ComposerField {
  path: string; label: string; type?: string; required?: boolean;
}
export const composerGroups: { id: string; title: string; fields: ComposerField[] }[] = [
  { id: "test", title: "시험·시료·희망 일정", fields: [
    { path: "test.purpose", label: "시험 목적", type: "textarea", required: true },
    { path: "sample.name", label: "시료명", required: true },
    { path: "sample.quantity", label: "시료 수량", type: "number", required: true },
    { path: "schedule.desiredStartDate", label: "희망 시작일", type: "date", required: true },
    { path: "schedule.desiredEndDate", label: "희망 종료일", type: "date", required: true },
    { path: "sample.readyDate", label: "시료 준비 완료일", type: "date" },
    { path: "test.standard", label: "시험 규격" },
    { path: "notes", label: "추가 전달 사항", type: "textarea" },
  ] },
  { id: "applicant", title: "신청자 정보", fields: [
    { path: "applicant.companyName", label: "기업·조직명", required: true },
    { path: "applicant.contactName", label: "신청 담당자", required: true },
    { path: "applicant.email", label: "신청자 이메일", type: "email", required: true },
    { path: "applicant.phone", label: "신청자 연락처", type: "tel" },
  ] },
  { id: "actualUser", title: "실사용자", fields: [
    { path: "actualUser.name", label: "실사용자 이름", required: true },
    { path: "actualUser.phone", label: "실사용자 전화", type: "tel" },
    { path: "actualUser.email", label: "실사용자 이메일", type: "email" },
  ] },
  { id: "accounting", title: "회계 담당자", fields: [
    { path: "accounting.name", label: "회계 담당자 이름", required: true },
    { path: "accounting.phone", label: "회계 담당자 전화", type: "tel" },
    { path: "accounting.email", label: "회계 담당자 이메일", type: "email" },
  ] },
];
export const fieldId = (path: string) => `request-${path.replaceAll(".", "-")}`;
export function contentValue(content: RequestContent, path: string): string | number {
  return path.split(".").reduce<unknown>((v, k) => v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined, content) as string | number ?? "";
}
export function changeContent(content: RequestContent, path: string, value: unknown): RequestContent {
  const [section, key] = path.split(".");
  if (!key) return { ...content, [section]: value };
  return { ...content, [section]: { ...(content[section as keyof RequestContent] as object), [key]: value } };
}
// Apply known account details once when opening a server draft. Never infer missing test facts.
export function hydrateRequest(content: RequestContent, user: User, notes: string): RequestContent {
  const applicant = {
    companyName: content.applicant?.companyName || user.organization?.name || "",
    contactName: content.applicant?.contactName || user.name || "",
    email: content.applicant?.email || user.email || "",
    phone: content.applicant?.phone || user.phone || "",
  };
  return { ...content, applicant, test: { ...content.test }, sample: { ...content.sample },
    schedule: { ...content.schedule }, conditions: content.conditions ?? [],
    actualUser: content.actualUser ?? { name: applicant.contactName, phone: applicant.phone, email: applicant.email },
    accounting: content.accounting ?? {}, notes: content.notes || (notes.trim() !== content.test?.purpose?.trim() ? notes : "") || "" };
}
const present = (value: unknown) => value != null && String(value).trim() !== "";
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function missingRequestFields(content: RequestContent): { path: string; label: string }[] {
  const missing = composerGroups.flatMap(g => g.fields).filter(f => f.required && !present(contentValue(content, f.path))).map(f => ({ path: f.path, label: f.label }));
  for (const group of composerGroups) for (const f of group.fields) {
    const value = contentValue(content, f.path);
    if (present(value) && ((f.type === "email" && !validEmail(String(value))) || (f.type === "date" && !validDate(String(value)))))
      missing.push({ path: f.path, label: `${f.label} 형식 확인` });
  }
  if (present(content.sample.quantity) && (!Number.isInteger(content.sample.quantity) || Number(content.sample.quantity) < 1))
    missing.push({ path: "sample.quantity", label: "시료 수량 확인" });
  for (const section of ["actualUser", "accounting"] as const) {
    const person = content[section];
    if (!present(person?.phone) && !present(person?.email))
      missing.push({ path: `${section}.phone`, label: `${section === "actualUser" ? "실사용자" : "회계 담당자"} 연락처` });
  }
  if (content.schedule.desiredStartDate && content.schedule.desiredEndDate && content.schedule.desiredStartDate > content.schedule.desiredEndDate)
    missing.push({ path: "schedule.desiredEndDate", label: "종료일은 시작일 이후로 선택" });
  return missing;
}
