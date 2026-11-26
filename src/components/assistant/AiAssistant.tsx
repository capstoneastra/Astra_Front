import { useEffect, useRef } from "react";
import { BotMessageSquare, MessageSquareText, X } from "lucide-react";
import Chatbot from "../Chatbot";

export default function AiAssistant({
  chatPanelKey,
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
          <button
            type="button"
            className="icon-button"
            aria-label="AI 패널 닫기"
            title="닫아도 대화는 유지됩니다"
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </button>
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
