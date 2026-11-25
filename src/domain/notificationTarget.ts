import type { Notification } from "../services/notificationService";

export type NotificationTarget =
  | { kind: "request"; id: number; action: string }
  | { kind: "menu"; menu: string; focus?: "members" | "organizations"; action: string };

/** 알림을 눌렀을 때 이동할 작업. 서버가 link 를 주면 그대로, 없으면 메시지의 [분류]로 추정합니다. */
export function notificationTarget(n: Notification, role: string): NotificationTarget {
  const requestsMenu = role === "INSTITUTION_MANAGER" ? "review" : "reservationCheck";
  const link = n.link;
  if (link?.type === "REQUEST" && link.id) return { kind: "request", id: link.id, action: "의뢰 열기" };
  if (link?.type === "USER_APPROVAL") return { kind: "menu", menu: "admin", focus: "members", action: "승인하기" };
  if (link?.type === "ORGANIZATION_APPROVAL") return { kind: "menu", menu: "admin", focus: "organizations", action: "승인하기" };
  if (link?.type === "EQUIPMENT") return { kind: "menu", menu: "manager", action: "정보 갱신" };
  const text = n.message;
  if (/가입/.test(text) && role === "ADMIN") return { kind: "menu", menu: "admin", focus: "members", action: "승인하기" };
  if (/기관 등록|기관 신청/.test(text) && role === "ADMIN") return { kind: "menu", menu: "admin", focus: "organizations", action: "승인하기" };
  if (/정보 갱신|장비 정보/.test(text) && role !== "COMPANY_USER") return { kind: "menu", menu: "manager", action: "정보 갱신" };
  if (/일정|예약/.test(text) && role !== "ADMIN") return { kind: "menu", menu: "calendar", action: "일정 보기" };
  return { kind: "menu", menu: role === "ADMIN" ? "notifications" : requestsMenu, action: "확인하기" };
}
