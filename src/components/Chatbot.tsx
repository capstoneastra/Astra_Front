import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Check, CircleHelp, FileText, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { chatService } from "../services/chatService";
import type { ChatExchange } from "../services/chatService";
import { testTypeLabel } from "../services/equipmentService";
import { Feedback } from "./workflow/Feedback";
import { valueText } from "../domain/constants";
import type { RequirementCondition } from "../services/contracts";

const sizeLabel = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`);

const starters = [
  { title: "진동시험 장비 찾기", prompt: "위성 전장품 15kg, 20~2000Hz 랜덤 진동시험이 필요해요" },
  { title: "열진공 조건 정리", prompt: "카메라 모듈을 -40~70도 열진공 시험하고 싶어요" },
  { title: "EMC 시험 준비", prompt: "S-band 송신기 EMC 시험을 하려면 무엇을 준비해야 하나요?" },
  { title: "어떤 시험이 필요한지 모르겠어요", prompt: "큐브위성 발사 전에 어떤 환경시험이 필요한가요?" },
];

interface Metadata {
  suggestedTestType?: string;
  extractedConditions?: RequirementCondition[];
  missingQuestions?: string[];
  candidates?: { id: number; name: string; institution: string }[];
}

/** 최신 AI 답변을 글자 단위로 보여 주어 실제 대화처럼 느껴지게 합니다. */
function useTypewriter(text: string, active: boolean) {
  const [shown, setShown] = useState(active ? 0 : text.length);
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const step = Math.max(1, Math.round(text.length / 60));
    const timer = window.setInterval(() => {
      setShown((value) => {
        if (value + step >= text.length) window.clearInterval(timer);
        return Math.min(text.length, value + step);
      });
    }, 16);
    return () => window.clearInterval(timer);
  }, [text, active]);
  return text.slice(0, shown);
}

function AiBubble({ text, animate, onDone }: { text: string; animate: boolean; onDone?: () => void }) {
  const shown = useTypewriter(text, animate);
  const done = shown.length === text.length;
  useEffect(() => { if (done) onDone?.(); }, [done, onDone]);
  return <div className="chat-bubble">{shown}{!done && <span className="chat-caret" aria-hidden="true" />}</div>;
}

export default function Chatbot({ setActiveMenu }: { setActiveMenu: (menu: string) => void }) {
  const { setTestCondition, chatSessionId, setChatSessionId, setRequirementId, setMatchRun } = useWorkspace();
  const history = useApiQuery(
    (signal) => chatService.messages(chatSessionId, signal),
    `chat:${chatSessionId}`,
    Boolean(chatSessionId),
  );
  const [exchange, setExchange] = useState<ChatExchange | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [animatedId, setAnimatedId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(true);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<{ name: string; size: number; text?: string }[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const action = useAction();
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const historyMessages = history.data?.content ?? [];
  const all = [
    ...historyMessages,
    ...[exchange?.userMessage, exchange?.assistantMessage].filter((m) => m && !historyMessages.some((old) => old.id === m.id)),
  ];
  const lastAi = [...all].reverse().find((m) => m.role !== "USER");
  const metadata = (lastAi?.metadata ?? null) as Metadata | null;
  const conditions = metadata?.extractedConditions ?? [];
  const busy = action.busy;

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [all.length, pending, revealed]);

  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 140)}px`;
  }, [input]);

  // 첨부: 글 파일(txt·csv·md)은 내용 일부를 함께 보내고, 그 밖의 파일은 이름만 알립니다.
  // ※ 파일 자체 업로드는 백엔드 첨부 API 가 생기면 이 부분에서 업로드 후 id 를 함께 보내면 됩니다.
  const attach = async (list: FileList | null) => {
    const picked = [...(list ?? [])].slice(0, 5 - files.length);
    const next = await Promise.all(picked.map(async (f) => ({
      name: f.name, size: f.size,
      text: /\.(txt|csv|md|tsv|json)$/i.test(f.name) && f.size < 200_000 ? (await f.text()).slice(0, 2000) : undefined,
    })));
    setFiles((current) => [...current, ...next].slice(0, 5));
    field.current?.focus();
  };

  const send = (text = input) => {
    const typed = text.trim();
    if ((!typed && !files.length) || busy) return;
    const content = [typed || "첨부한 파일을 확인해 주세요.", ...files.map((f) => `📎 ${f.name} (${sizeLabel(f.size)})${f.text ? `\n${f.text}` : ""}`)].join("\n");
    setFiles([]);
    setPending(content);
    setInput("");
    void action.run(async (signal) => {
      let id = chatSessionId;
      if (!id) {
        const session = await chatService.create(content.slice(0, 30), signal);
        id = session.id;
        setChatSessionId(id);
      }
      const result = await chatService.send(id, content, signal);
      setExchange(result);
      setAnimatedId(result.assistantMessage.id);
      setRevealed(false);
      setTestCondition(
        (result.assistantMessage.metadata?.extractedConditions ?? [])
          .map((c) => `${c.label}: ${valueText(c)}${c.status === "CONFIRMED" ? "" : " (확인 필요)"}`)
          .join(" · "),
      );
    }).finally(() => setPending(null));
  };

  const reset = () => {
    setChatSessionId(null);
    setExchange(null);
    setInput("");
    setTestCondition("");
    field.current?.focus();
  };

  const toMatching = () => action.run(async (signal) => {
    const requirement = await chatService.requirement(chatSessionId, signal);
    setRequirementId(requirement.id);
    setMatchRun(null);
    setActiveMenu("matching");
  });

  const empty = all.length === 0 && !pending;

  return (
    <div className="chat">
      <div className="chat__scroller" ref={scroller} role="log" aria-label="AI 상담 대화" aria-live="polite">
        {empty ? (
          <div className="chat-welcome">
            <span className="chat-welcome__mark" aria-hidden="true"><Sparkles size={22} /></span>
            <h3>어떤 시험을 준비하고 계신가요?</h3>
            <p>시험 대상과 조건을 편하게 말씀해 주세요. 조건을 정리하고 맞는 장비를 찾아드려요.</p>
            <div className="chat-starters">
              {starters.map((item) => (
                <button type="button" key={item.title} onClick={() => send(item.prompt)}>
                  <strong>{item.title}</strong>
                  <span>{item.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {all.map((message) => message.role === "USER" ? (
              <div className="chat-msg chat-msg--user" key={message.id}><div className="chat-bubble">{message.content}</div></div>
            ) : (
              <div className="chat-msg chat-msg--ai" key={message.id}>
                <span className="chat-avatar" aria-hidden="true"><Sparkles size={14} /></span>
                <div className="chat-msg__stack">
                  <AiBubble text={message.content} animate={message.id === animatedId}
                    onDone={message.id === animatedId ? () => setRevealed(true) : undefined} />
                  {message.id === lastAi?.id && metadata?.suggestedTestType && (message.id !== animatedId || revealed) && (
                    <div className="chat-card">
                      <div className="chat-card__head">
                        <span>정리된 시험조건</span>
                        <strong>{testTypeLabel(metadata.suggestedTestType)}</strong>
                      </div>
                      {conditions.length > 0 && (
                        <ul className="chat-card__conditions">
                          {conditions.map((c) => (
                            <li key={c.key} className={c.status === "CONFIRMED" ? "is-confirmed" : c.status === "MISSING" ? "is-missing" : "is-unconfirmed"}>
                              {c.status === "CONFIRMED" ? <Check size={12} aria-hidden="true" /> : <CircleHelp size={12} aria-hidden="true" />}
                              <span>{c.label}</span>
                              <b>{c.status === "MISSING" ? "필요" : valueText(c)}</b>
                            </li>
                          ))}
                        </ul>
                      )}
                      {metadata.candidates?.length > 0 && (
                        <ul className="chat-card__candidates">
                          {metadata.candidates.map((item) => <li key={item.id}><strong>{item.name}</strong><small>{item.institution}</small></li>)}
                        </ul>
                      )}
                      <div className="chat-card__actions">
                        <button type="button" className="chat-action chat-action--primary" disabled={busy} onClick={toMatching}>
                          추천 장비 비교하기 <ArrowRight size={14} aria-hidden="true" />
                        </button>
                        <button type="button" className="chat-action" onClick={() => setActiveMenu("search")}>
                          <Search size={14} aria-hidden="true" /> 장비 검색
                        </button>
                      </div>
                    </div>
                  )}
                  {message.id === lastAi?.id && (metadata?.missingQuestions?.length ?? 0) > 0 && (message.id !== animatedId || revealed) && (
                    <div className="chat-quick" aria-label="빠른 답변">
                      {metadata.missingQuestions.map((question) => (
                        <button type="button" key={question} onClick={() => { setInput(`${question}는 `); field.current?.focus(); }}>
                          {question} 입력
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {pending && !all.some((m) => m.role === "USER" && m.content === pending && m.id === exchange?.userMessage.id) && (
              <div className="chat-msg chat-msg--user"><div className="chat-bubble">{pending}</div></div>
            )}
            {busy && (
              <div className="chat-msg chat-msg--ai" role="status" aria-label="답변 작성 중">
                <span className="chat-avatar" aria-hidden="true"><Sparkles size={14} /></span>
                <div className="chat-bubble chat-typing"><i /><i /><i /></div>
              </div>
            )}
          </>
        )}
        <Feedback action={{ ...action, error: action.error ?? history.error }} />
      </div>

      {files.length > 0 && (
        <ul className="chat-files" aria-label="첨부한 파일">
          {files.map((f, i) => (
            <li key={`${f.name}${i}`}>
              <FileText size={13} aria-hidden="true" /><span>{f.name}</span><small>{sizeLabel(f.size)}</small>
              <button type="button" aria-label={`${f.name} 첨부 취소`} onClick={() => setFiles(files.filter((_, k) => k !== i))}><X size={12} /></button>
            </li>
          ))}
        </ul>
      )}
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <button type="button" className="chat-composer__attach" onClick={() => picker.current?.click()} title="파일 첨부 (최대 5개)" aria-label="파일 첨부" disabled={files.length >= 5}>
          <Plus size={18} />
        </button>
        <input ref={picker} type="file" multiple hidden onChange={(e) => { void attach(e.target.files); e.target.value = ""; }} />
        {!empty && (
          <button type="button" className="chat-composer__reset" onClick={reset} title="새 대화" aria-label="새 대화 시작">
            <RotateCcw size={16} />
          </button>
        )}
        <label className="sr-only" htmlFor="chat-input">메시지</label>
        <textarea
          id="chat-input"
          ref={field}
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="시험 대상과 조건을 입력하세요"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="chat-composer__send" disabled={(!input.trim() && !files.length) || busy} aria-label="보내기">
          <ArrowUp size={18} />
        </button>
      </form>
    </div>
  );
}
