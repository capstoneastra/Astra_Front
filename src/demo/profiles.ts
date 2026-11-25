import type { User } from "../services/authService";
import { profileErrors } from "../domain/profile";
import { reject } from "./http";

const key = "astra.demo.profiles.v1";
const statusesKey = "astra.demo.member-status.v1";
export function withDemoProfile(user: User): User {
  let current = user;
  try {
    const status = JSON.parse(localStorage.getItem(statusesKey) ?? "{}")[user.id];
    if (["ACTIVE", "SUSPENDED", "PENDING", "REJECTED"].includes(status)) current = { ...user, status };
  } catch { /* A missing DEMO status override leaves the seeded account unchanged. */ }
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "{}")[user.id];
    return saved && typeof saved.name === "string" && typeof saved.phone === "string" && !Object.keys(profileErrors(saved)).length
      ? { ...current, name: saved.name, phone: saved.phone } : current;
  } catch { return current; }
}
export function setDemoMemberStatus(user: User, status: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(statusesKey) ?? "{}");
    stored[user.id] = status;
    localStorage.setItem(statusesKey, JSON.stringify(stored));
  } catch { reject(500, "DEMO_STORAGE_ERROR", "계정 상태를 저장할 수 없습니다."); }
  return withDemoProfile(user);
}
export function saveDemoProfile(user: User, body: Record<string, unknown>): User {
  if (Object.keys(body).some(field => !["name", "phone"].includes(field))) reject(400, "VALIDATION_ERROR", "이름과 연락처만 수정할 수 있습니다.");
  const next = { name: body.name ?? user.name, phone: body.phone ?? user.phone ?? "" };
  if (typeof next.name !== "string" || typeof next.phone !== "string" || Object.keys(profileErrors(next as { name: string; phone: string })).length)
    reject(400, "VALIDATION_ERROR", "이름과 연락처를 확인해주세요.");
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
    stored[user.id] = { name: (next.name as string).trim(), phone: (next.phone as string).trim() };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch { reject(500, "DEMO_STORAGE_ERROR", "프로필을 저장할 수 없습니다. 브라우저 저장소를 확인해주세요."); }
  return withDemoProfile(user);
}
