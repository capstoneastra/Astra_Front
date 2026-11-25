import type { User } from "../services/authService";
import { previewUsers } from "../preview/user";
import { withDemoProfile } from "./profiles";
const key = "astra.demo.login.v1";
export const demoAccounts = [
  { email: "company@astra.demo", user: previewUsers.company, label: "기업 A" },
  { email: "company2@astra.demo", user: { ...previewUsers.company, id: 6, name: "기업 B 담당자", email: "company2@astra.demo", organization: { id: 14, name: "DEMO 다른 기업", isVerified: true } }, label: "기업 B" },
  { email: "manager1@astra.demo", user: previewUsers.institution, label: "기관" },
  { email: "univ1@astra.demo", user: previewUsers.university, label: "대학" },
  { email: "admin@astra.demo", user: previewUsers.admin, label: "관리자" },
] as const;
// docs/api-spec.md §1: V9 seed credentials. Only imported by the DEV DEMO entry.
export const DEMO_PASSWORD = "12345678";
export const quickDemoAccounts = [demoAccounts[0], demoAccounts[2], demoAccounts[3], demoAccounts[4]];
const legacyEmails: Record<string, string> = { "partner@astra.demo": "company2@astra.demo", "institution@astra.demo": "manager1@astra.demo", "university@astra.demo": "univ1@astra.demo" };
export function readDemoUser(): User | null {
  try {
    const session = JSON.parse(sessionStorage.getItem(key) ?? "null");
    const email = legacyEmails[session?.email] ?? session?.email;
    const user = session?.expiresAt > Date.now() ? demoAccounts.find(a => a.email === email)?.user : null;
    const current = user ? withDemoProfile({ ...user, email }) : null;
    return current?.status === "ACTIVE" ? current : null;
  } catch { return null; }
}
export function writeDemoSession(email: string) { sessionStorage.setItem(key, JSON.stringify({ email, expiresAt: Date.now() + 4 * 60 * 60 * 1000 })); }
export function clearDemoSession() { sessionStorage.removeItem(key); }
