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
  read: (id: ResourceId) => mutate("PATCH", `/notifications/${id}/read`, {}),
  readAll: () => mutate("POST", "/notifications/read-all", {}),
};
