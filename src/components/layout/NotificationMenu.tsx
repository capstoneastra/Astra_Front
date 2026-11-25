import { useId } from "react";
import { Bell, CalendarDays, ClipboardList, Database, ShieldCheck } from "lucide-react";
import { useApiQuery } from "../../hooks/useApiQuery";
import { useAction } from "../../hooks/useAction";
import { notificationService } from "../../services/notificationService";
import type { Notification } from "../../services/notificationService";
import { notificationTarget } from "../../domain/notificationTarget";
import type { NotificationTarget } from "../../domain/notificationTarget";

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

const iconFor = (target: NotificationTarget) =>
  target.kind === "request" ? ClipboardList
    : target.menu === "admin" ? ShieldCheck
      : target.menu === "manager" ? Database
        : target.menu === "calendar" ? CalendarDays : Bell;

/** 헤더 아래로 펼쳐지는 알림. 항목을 누르면 읽음 처리 후 관련 작업으로 바로 이동합니다. */
export default function NotificationMenu({ userId, role, open, onToggle, onClose, onOpenTarget, onShowAll }: {
  userId: number;
  role: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpenTarget: (target: NotificationTarget) => void;
  onShowAll: () => void;
}) {
  const panelId = useId();
  const action = useAction();
  const unread = useApiQuery(notificationService.unreadCount, `notifications-unread:${userId}`);
  const list = useApiQuery((signal) => notificationService.list(signal), "notifications", open);
  const items = [...(list.data?.content ?? [])].sort((a, b) => Number(a.isRead) - Number(b.isRead)).slice(0, 6);
  const count = unread.data ?? 0;

  const openItem = (item: Notification) => {
    const target = notificationTarget(item, role);
    if (!item.isRead) void action.run(() => notificationService.read(item.id));
    onClose();
    onOpenTarget(target);
  };

  return (
    <div className="header-menu">
      <button type="button" className={`icon-button header-notifications${count > 0 ? " has-unread" : ""}`}
        aria-label={count > 0 ? `업무 알림, 읽지 않은 알림 ${count}건` : "업무 알림"}
        aria-haspopup="true" aria-expanded={open} aria-controls={panelId} title="업무 알림" onClick={onToggle}>
        <Bell size={18} aria-hidden="true" />
        {count > 0 && <span aria-hidden="true">{count > 99 ? "99+" : count}</span>}
      </button>
      <div className="header-dropdown notice-menu" id={panelId} hidden={!open}>
        <div className="notice-menu__head">
          <strong>업무 알림</strong>
          {count > 0 && <span>읽지 않음 {count}</span>}
          <button type="button" className="text-link" disabled={!count || action.busy} onClick={() => action.run(() => notificationService.readAll())}>모두 읽음</button>
        </div>
        {list.loading ? (
          <div className="api-skeleton" aria-label="불러오는 중"><span /><span /><span /></div>
        ) : list.error ? (
          <p className="notice-menu__empty">{list.error.message}</p>
        ) : items.length ? (
          <ul>
            {items.map((item) => {
              const target = notificationTarget(item, role);
              const Icon = iconFor(target);
              const [, tag, rest] = item.message.match(/^\[([^\]]+)\]\s*(.*)$/) ?? [null, null, item.message];
              return (
                <li key={item.id}>
                  <button type="button" className={item.isRead ? "is-read" : undefined} onClick={() => openItem(item)}>
                    <span className="notice-menu__icon"><Icon size={15} aria-hidden="true" /></span>
                    <span className="notice-menu__body">
                      {tag && <em>{tag}</em>}
                      <span>{rest}</span>
                      <small>{timeAgo(item.createdAt)}</small>
                    </span>
                    <span className="notice-menu__action">{target.action}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="notice-menu__empty">새로운 업무 알림이 없습니다.</p>
        )}
        <button type="button" className="notice-menu__all" onClick={() => { onClose(); onShowAll(); }}>전체 알림 보기</button>
      </div>
    </div>
  );
}
