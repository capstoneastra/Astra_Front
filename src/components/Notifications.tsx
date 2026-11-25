import { Bell, Check } from "lucide-react";
import { Button, EmptyState, PageHeader, Panel } from "./ui/index";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { notificationService } from "../services/notificationService";
import { Feedback } from "./workflow/Feedback";
import { formatDate } from "../domain/constants";
import ApiState from "./ui/ApiState";
import { useAuth } from "../auth/context";
import { notificationTarget } from "../domain/notificationTarget";
import type { NotificationTarget } from "../domain/notificationTarget";

/** 업무 알림 — 읽지 않은 알림을 위에 두고, 행을 누르면 읽음 처리됩니다. */
export default function Notifications({ onOpenTarget }: { onOpenTarget?: (target: NotificationTarget) => void }) {
  const { user } = useAuth();
  const query = useApiQuery((signal) => notificationService.list(signal), "notifications");
  const action = useAction();
  const items = [...(query.data?.content ?? [])].sort((a, b) => Number(a.isRead) - Number(b.isRead));
  const unread = items.filter((n) => !n.isRead).length;
  return (
    <div className="content-page content-page--reading page-enter">
      <PageHeader title="업무 알림" description={unread ? `읽지 않은 알림 ${unread}건` : "모든 알림을 확인했습니다."}>
        <Button variant="secondary" icon={Check} disabled={action.busy || !unread} onClick={() => action.run(() => notificationService.readAll())}>
          모두 읽음
        </Button>
      </PageHeader>
      <Feedback action={action} />
      <Panel className="notice-list">
        {query.loading || query.error ? (
          <ApiState loading={query.loading} error={query.error} onRetry={query.reload} />
        ) : items.length ? (
          <ul>
            {items.map((n) => (
              <li key={n.id} className={n.isRead ? "is-read" : undefined}>
                <button type="button" disabled={action.busy} onClick={() => {
                  if (!n.isRead) void action.run(() => notificationService.read(n.id));
                  onOpenTarget?.(notificationTarget(n, user.role));
                }}>
                  <span className="notice-list__dot" aria-hidden="true" />
                  <span className="notice-list__body">
                    <strong>{n.message}</strong>
                    <small>{formatDate(n.createdAt)}</small>
                  </span>
                  <span className="notice-list__hint">{notificationTarget(n, user.role).action}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Bell} title="새로운 업무 알림이 없습니다" />
        )}
      </Panel>
    </div>
  );
}
