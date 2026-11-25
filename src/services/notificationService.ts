import { getData, mutate } from "./http";
import type { Page, ResourceId } from "./contracts";

export interface Notification {
  id: number;
  message: string;
  isRead: boolean;
  createdAt: string;
  /**
   * 관련 작업으로 바로 이동하기 위한 링크 (백엔드 확인 필요 · docs/backend-handoff.md P2).
   * 없으면 메시지 앞의 [분류] 문구로 이동할 화면을 추정합니다.
   */
  link?: { type: "REQUEST" | "USER_APPROVAL" | "ORGANIZATION_APPROVAL" | "EQUIPMENT"; id?: number | null } | null;
}

export const notificationService = {
  list: (signal?: AbortSignal) => getData<Page<Notification>>("/notifications", { size: 100 }, signal),
  unreadCount: async (signal?: AbortSignal) => {
    const page = await getData<Page<Notification>>("/notifications", { unreadOnly: true, size: 1 }, signal);
    return page.totalElements;
  },
  read: (id: ResourceId) => mutate("PATCH", `/notifications/${id}/read`, {}),
  readAll: () => mutate("POST", "/notifications/read-all", {}),
};
