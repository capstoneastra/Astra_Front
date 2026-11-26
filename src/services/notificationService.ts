import { getData, mutate } from "./http";
import type { Page, ResourceId } from "./contracts";

/** 서버 응답 그대로 (GET /notifications): 제목·본문·종류·관련 의뢰. message 필드는 없다. */
interface NotificationDto {
  id: number;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  linkPath?: string | null;
  relatedRequestId?: number | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface Notification {
  id: number;
  /** 화면에 보이는 한 줄: 제목 (본문이 있으면 이어서). 서버의 title·body로 만든다. */
  message: string;
  type?: string | null;
  isRead: boolean;
  createdAt: string;
  /** 관련 작업으로 바로 이동하기 위한 링크. 서버의 relatedRequestId·type으로 만든다. */
  link?: { type: "REQUEST" | "USER_APPROVAL" | "ORGANIZATION_APPROVAL" | "EQUIPMENT"; id?: number | null } | null;
}

/** 서버 알림 → 화면 알림. 예전처럼 message 를 읽던 화면이 깨지지 않게 여기서 한 번에 맞춘다. */
function toNotification(dto: NotificationDto): Notification {
  const title = dto.title?.trim() || "알림";
  const body = dto.body?.trim();
  const link: Notification["link"] =
    dto.relatedRequestId ? { type: "REQUEST", id: dto.relatedRequestId }
      : dto.type === "USER_APPROVAL_REQUESTED" ? { type: "USER_APPROVAL" }
        : dto.type === "EQUIPMENT_UPDATE_REQUIRED" ? { type: "EQUIPMENT" }
          : null;
  return {
    id: dto.id,
    message: body && body !== title ? `${title} ${body}` : title,
    type: dto.type ?? null,
    isRead: dto.isRead,
    createdAt: dto.createdAt,
    link,
  };
}

export const notificationService = {
  list: async (signal?: AbortSignal): Promise<Page<Notification>> => {
    const page = await getData<Page<NotificationDto>>("/notifications", { size: 100 }, signal);
    return { ...page, content: (page.content ?? []).map(toNotification) };
  },
  unreadCount: async (signal?: AbortSignal) => {
    const page = await getData<Page<NotificationDto>>("/notifications", { unreadOnly: true, size: 1 }, signal);
    return page.totalElements;
  },
  read: (id: ResourceId) => mutate("PATCH", `/notifications/${id}/read`, {}),
  readAll: () => mutate("POST", "/notifications/read-all", {}),
};
