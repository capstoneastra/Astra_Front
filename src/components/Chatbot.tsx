import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Orbit, Send, Sparkles } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { Badge, Button, PageHeader, Panel } from "./ui";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { chatService } from "../services/chatService";
import type { ChatExchange } from "../services/chatService";
import { Feedback } from "./workflow/Feedback";
import { valueText } from "../domain/constants";
import { apiConfig } from "../api/config";

export default function Chatbot({ setActiveMenu, embedded = false }) {
  const {
    setTestCondition,
    chatSessionId,
    setChatSessionId,
    setRequirementId,
    setMatchRun,
  } = useWorkspace();
  const history = useApiQuery(
    (signal) => chatService.messages(chatSessionId, signal),
    `chat:${chatSessionId}`,
    Boolean(chatSessionId),
  );
  const [exchange, setExchange] = useState<ChatExchange | null>(null),
    action = useAction();
  const historyMessages = history.data?.content ?? [];
  const all = [
    ...historyMessages,
    ...[exchange?.userMessage, exchange?.assistantMessage].filter(
      (m) => m && !historyMessages.some((old) => old.id === m.id),
    ),
  ];
  const messages = all.length
    ? all.map((m) => ({
        sender: m.role === "USER" ? "user" : "ai",
        text: m.content,
      }))
    : [
        {
          sender: "ai",
          text: "안녕하세요. 어떤 우주항공 시험장비가 필요하신가요?",
        },
      ];
  const metadata =
    exchange?.assistantMessage.metadata ??
    historyMessages.filter((m) => m.role === "ASSISTANT").at(-1)?.metadata;
  const [input, setInput] = useState("");
  const isConditionReady = Boolean(metadata?.suggestedTestType);
  const isSending = action.busy;
  const messagesEnd = useRef(null);
  const messageCount = messages.length;

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({
      block: "nearest",
      behavior: "instant",
    });
  }, [messageCount, isSending]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    action.run(async (signal) => {
      let id = chatSessionId;
      if (!id) {
        const session = await chatService.create("시험조건 상담", signal);
        id = session.id;
        setChatSessionId(id);
      }
      const result = await chatService.send(id, input.trim(), signal);
      setExchange(result);
      setInput("");
      setTestCondition(
        (result.assistantMessage.metadata?.extractedConditions ?? [])
          .map(
            (c) =>
              `${c.label}: ${valueText(c)}${c.status === "CONFIRMED" ? "" : " (미확인)"}`,
          )
          .join(" · "),
      );
    });
  };

  return (
    <div className="content-page page-enter chatbot-workspace">
      {!embedded && <PageHeader title="AI 시험 상담" />}
      <div className="chat-layout">
        <Panel className="chat-panel">
          {!embedded && <div className="chat-panel__heading">
            <span className="chat-avatar">
              <Orbit size={21} />
            </span>
            <div>
              <h2>ASTRA AI 어시스턴트</h2>
              <small>시험 준비를 위한 대화형 워크스페이스</small>
            </div>
            <Badge tone="violet">{apiConfig.isMock ? "DEMO" : "API"}</Badge>
          </div>}
          <div
            className="chat-messages"
            role="log"
            aria-label="상담 대화"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((msg, idx) => (
              <div className={`message message--${msg.sender}`} key={idx}>
                {msg.sender === "ai" && (
                  <span className="chat-avatar">
                    <Sparkles size={14} />
                  </span>
                )}
                <div className="message__body">
                  <span>{msg.sender === "ai" ? "ASTRA AI" : "나"}</span>
                  <div className="message__bubble">{msg.text}</div>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="message">
                <span className="chat-avatar">
                  <Sparkles size={14} />
                </span>
                <div className="message__bubble" role="status">
                  응답을 준비하고 있습니다…
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>
          {messages.length === 1 && (
            <div className="chat-examples">
              <button
                onClick={() =>
                  setInput("위성 전장품 15kg, 20~2000Hz 진동시험이 필요해요")
                }
              >
                항공 부품 진동시험
              </button>
              <button onClick={() => setInput("시험조건을 어떻게 정리하나요?")}>
                시험조건 정리하기
              </button>
            </div>
          )}
          <div className="chat-form">
            <label className="sr-only" htmlFor="chat-input">
              상담 메시지
            </label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="필요한 시험을 편하게 이야기해주세요"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  handleSend();
              }}
            />
            <Button
              icon={Send}
              onClick={handleSend}
              disabled={!input.trim() || isSending}
            >
              <span>전송</span>
            </Button>
          </div>
          <p className="chat-panel__footnote">
            {apiConfig.isMock ? "DEMO 상담 · 실제 AI 분석이 아닙니다." : "AI가 정리한 조건은 제출 전 확인해주세요."}
          </p>
        </Panel>
        {isConditionReady && <Panel
          title="정리된 시험조건"
          action={<Sparkles size={15} color="var(--violet)" />}
          className="chat-conditions"
        >
          <div className="chat-conditions__body">
            {isConditionReady ? (
              <>
                <div className="condition-ready">
                  <span>
                    <Check size={12} />
                    조건 추출 · 사용자 확인 필요
                  </span>
                  {metadata?.extractedConditions?.map((c) => (
                    <p key={c.key}>
                      {c.label}:{" "}
                      {c.status === "MISSING" ? "미확인" : valueText(c)}{" "}
                      {c.status === "UNCONFIRMED" && "(사용자 확인 필요)"}
                    </p>
                  ))}
                </div>
                <p>
                  조건 분석 화면에서 누락 항목을 보완하고 장비별 규칙 비교와
                  의뢰서 초안 작성을 진행할 수 있습니다.
                </p>
                <div style={{ height: 17 }} />
                <Button
                  icon={ArrowRight}
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async (signal) => {
                      const requirement = await chatService.requirement(
                        chatSessionId,
                        signal,
                      );
                      setRequirementId(requirement.id);
                      setMatchRun(null);
                      setActiveMenu("matching");
                    })
                  }
                >
                  시험조건 분석으로 이어가기
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setActiveMenu("search")}
                >
                  장비 검색으로 이어가기
                </Button>
              </>
            ) : (
              <>
                <p>
                  대화를 시작하면 이곳에서 정리된 시험조건을 확인할 수 있습니다.
                </p>
                <ol className="condition-steps">
                  <li>시험 목적 이야기하기</li>
                  <li>시험조건 확인하기</li>
                  <li>장비 검색으로 연결하기</li>
                </ol>
                <Badge>상담 대기 중</Badge>
              </>
            )}
          </div>
        </Panel>}
      </div>
      <Feedback action={{ ...action, error: action.error ?? history.error }} />
    </div>
  );
}
