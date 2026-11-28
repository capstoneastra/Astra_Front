import { useEffect, useRef, useState } from "react";
import { BotMessageSquare, History, MessageSquareText, SquarePen, X } from "lucide-react";
import Chatbot from "../Chatbot";
import { useAuth } from "../../auth/context";
import { useApiQuery } from "../../hooks/useApiQuery";
import { chatService } from "../../services/chatService";

/** 이전 상담 목록의 날짜: 오늘이면 시:분, 올해면 월.일, 그 전이면 연.월.일 (한국 시간) */
function sessionDate(value?: string | null) {
  if (!value) return "";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const day = (d: Date) => d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  if (day(at) === day(new Date()))
    return at.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
  const sameYear = at.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric" }) ===
    new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric" });
  return at.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", ...(sameYear ? {} : { year: "2-digit" }), month: "numeric", day: "numeric" });
}

/** 머리글 [이전 상담] — 누르면 내 상담 목록(GET /chat/sessions)이 펼쳐지고, 고르면 그 대화를 다시 엶 */
function ChatHistoryMenu({ sessionId, onOpenChat }: { sessionId: number | null; onOpenChat: (id: number) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const sessions = useApiQuery((signal) => chatService.list(signal), `chat-sessions:${user.id}`, open);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const list = sessions.data?.content ?? [];
  return (
    <div ref={root} className="ai-history"
      onKeyDown={(e) => {
        // Esc 는 목록만 닫고, 상담 창까지 닫히지 않게
        if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); root.current?.querySelector<HTMLElement>(".ai-history__toggle")?.focus(); }
      }}>
      <button type="button" className="icon-button ai-tip ai-history__toggle" data-tip="이전 상담" aria-label="이전 상담"
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <History size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="ai-history__menu" role="menu" aria-label="이전 상담">
          <p className="ai-history__head">이전 상담</p>
          {sessions.loading ? (
            <p className="ai-history__state">불러오는 중…</p>
          ) : sessions.error ? (
            <p className="ai-history__state">목록을 불러오지 못했어요. <button type="button" className="text-link" onClick={sessions.reload}>다시 시도</button></p>
          ) : list.length ? (
            <ul>
              {list.map((s) => {
                const current = s.id === sessionId;
                return (
                  <li key={s.id}>
                    <button type="button" role="menuitem" className={current ? "is-current" : undefined} aria-current={current || undefined}
                      onClick={() => { setOpen(false); if (!current) onOpenChat(s.id); }}>
                      <span className="ai-history__title" title={s.title || "제목 없는 상담"}>{s.title || "제목 없는 상담"}</span>
                      <small>{current ? "지금 대화" : sessionDate(s.updatedAt ?? s.createdAt)}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ai-history__state">이전 상담이 없어요. 대화를 시작하면 여기에 쌓여요.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AiAssistant({
  chatPanelKey,
  sessionId,
  onNewChat,
  onOpenChat,
  open,
  started,
  modal,
  onOpen,
  onClose,
  onNavigate,
}) {
  const panel = useRef<HTMLElement>(null);
  const launcher = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const launchButton = launcher.current;
    panel.current?.querySelector<HTMLElement>("textarea, input")?.focus({ preventScroll: true });
    const closeWithEscape = (event) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      window.removeEventListener("keydown", closeWithEscape);
      const target =
        previous !== document.body &&
        previous?.isConnected &&
        !previous.closest("[inert]")
          ? previous
          : launchButton;
      target?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !modal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trapFocus = (event) => {
      if (event.key !== "Tab") return;
      const items = [
        ...panel.current.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href],[tabindex]",
        ),
      ].filter(
        (node) =>
          node.tabIndex >= 0 &&
          !node.matches(":disabled") &&
          node.getClientRects().length &&
          !node.closest("[inert]"),
      );
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    };
    window.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", trapFocus);
    };
  }, [open, modal]);

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className={`ai-launcher ${open ? "ai-launcher--open" : ""}`}
        aria-label="AI 어시스턴트 열기"
        title="AI 시험 상담"
        aria-expanded={open}
        aria-controls="astra-ai-assistant"
        aria-hidden={open || undefined}
        tabIndex={open ? -1 : 0}
        onClick={onOpen}
      >
        <BotMessageSquare size={22} aria-hidden="true" />
        <span>AI 상담</span>
      </button>
      <aside
        ref={(node) => {
          panel.current = node;
          if (node) node.inert = !open;
        }}
        id="astra-ai-assistant"
        className={`ai-assistant ${open ? "ai-assistant--open" : ""}`}
        hidden={!open}
        role={modal ? "dialog" : "complementary"}
        aria-modal={modal && open ? true : undefined}
        aria-label="ASTRA AI 어시스턴트"
      >
        <header className="ai-assistant__bar">
          {/* 의뢰 자동 작성 탭은 뺐다 (11/27). 이 패널은 AI 상담 하나만 */}
          <h2 className="ai-assistant__title"><MessageSquareText size={16} aria-hidden="true" />AI 상담</h2>
          {/* 새 상담·이전 상담: 글자 없이 아이콘만, 마우스를 올리면 이름이 뜸 (입력칸 옆 ↻ 버튼을 머리글로 옮김) */}
          <div className="ai-assistant__tools">
            {sessionId != null && (
              <button type="button" className="icon-button ai-tip" data-tip="새 상담" aria-label="새 상담" onClick={onNewChat}>
                <SquarePen size={17} aria-hidden="true" />
              </button>
            )}
            {started && <ChatHistoryMenu sessionId={sessionId} onOpenChat={onOpenChat} />}
            <button
              type="button"
              className="icon-button ai-tip"
              data-tip="닫기 · 대화는 유지돼요"
              aria-label="AI 패널 닫기"
              onClick={onClose}
            >
              <X size={19} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="ai-assistant__body">
          {started && (
            <section className="ai-assistant__pane ai-assistant__pane--chatbot" aria-label="AI 상담">
              <Chatbot key={chatPanelKey} setActiveMenu={onNavigate} />
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
