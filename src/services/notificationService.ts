import { getData, mutate } from "./http";
import type { Page, ResourceId } from "./contracts";

interface Notification {
  id: number;
  message: string;
  isRead: boolean;
  createdAt: string;
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
