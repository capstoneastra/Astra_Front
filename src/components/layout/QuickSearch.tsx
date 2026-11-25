import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Building2, Clock3, FlaskConical, Search, Telescope, X } from "lucide-react";
import { clearRecentSearches, readRecentSearches, removeRecentSearch } from "../../domain/recentSearches";

/**
 * 헤더 빠른 검색 (v7)
 * - 모달 없이 그 자리에서 검색창이 살짝 넓어지고, 단축키 표시는 사라집니다.
 * - 비어 있을 때: 최근 검색어 / 입력 중: 자동 완성(장비·기관·시험 종류 + 일치하는 최근 검색어)
 * - ↑↓ 로 고르고 Enter, Esc 로 닫기. Ctrl/⌘+K 로 어디서든 바로 입력.
 */
export interface SearchSuggestion {
  kind: "equipment" | "institution" | "testType";
  label: string;
  sub?: string;
  /** 고르면 실행할 검색 */
  query: string;
  options?: { institutionId?: number; testType?: string };
}
type Item =
  | { type: "recent"; label: string }
  | { type: "suggest"; s: SearchSuggestion }
  | { type: "recommend"; s: SearchSuggestion };

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const KIND_ICON = { equipment: Telescope, institution: Building2, testType: FlaskConical } as const;
const KIND_LABEL = { equipment: "장비", institution: "기관", testType: "시험 종류" } as const;

export default function QuickSearch({ userId, placeholder, sources, recommendations = [], onSearch }: {
  userId: number | string;
  placeholder: string;
  sources: SearchSuggestion[];
  /** 검색창이 비어 있을 때 보여줄 추천 검색어 (최근 검색어가 없어도 항상 표시) */
  recommendations?: SearchSuggestion[];
  onSearch: (query: string, options?: SearchSuggestion["options"]) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);

  const term = query.trim().toLowerCase();
  const items: Item[] = useMemo(() => {
    if (!term) return [
      ...recent.slice(0, 5).map((label) => ({ type: "recent", label }) as Item),
      ...recommendations.map((s) => ({ type: "recommend", s }) as Item),
    ];
    const recentHits: Item[] = recent.filter((r) => r.toLowerCase().includes(term) && r.toLowerCase() !== term).slice(0, 2).map((label) => ({ type: "recent", label }));
    const scored = sources
      .map((s) => {
        const text = `${s.label} ${s.sub ?? ""}`.toLowerCase();
        const at = s.label.toLowerCase().indexOf(term);
        const score = at === 0 ? 0 : at > 0 ? 1 : text.includes(term) ? 2 : initials(s.label).includes(term) ? 3 : -1;
        return { s, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score || a.s.label.length - b.s.label.length)
      .slice(0, 7)
      .map(({ s }) => ({ type: "suggest", s }) as Item);
    return [...recentHits, ...scored];
  }, [term, recent, sources, recommendations]);

  const show = open && (items.length > 0 || Boolean(term));

  const focus = () => {
    setRecent(readRecentSearches(userId));
    setOpen(true);
  };
  const close = () => { setOpen(false); setActive(-1); };
  const run = (q: string, options?: SearchSuggestion["options"]) => {
    onSearch(q.trim(), options);
    setQuery("");
    close();
    input.current?.blur();
  };
  const choose = (item: Item) => (item.type === "recent" ? run(item.label) : run(item.s.query, item.s.options));
  // 검색에 집중: 열려 있는 동안 화면 나머지를 살짝 어둡게
  useEffect(() => {
    document.body.classList.toggle("qsearch-open", open);
    return () => document.body.classList.remove("qsearch-open");
  }, [open]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close();
    };
    document.addEventListener("keydown", shortcut);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", shortcut); document.removeEventListener("pointerdown", outside); };
  }, []);

  const onKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) focus();
      const n = items.length;
      if (!n) return;
      setActive((a) => (event.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0 && items[active]) choose(items[active]); else run(query);
    } else if (event.key === "Escape") {
      if (query) setQuery(""); else { close(); input.current?.blur(); }
    }
  };

  return (
    <div ref={root} className={`qsearch${open ? " is-open" : ""}${query ? " has-value" : ""}`}>
      <div className="qsearch__field" onClick={() => input.current?.focus()}>
        <Search size={16} aria-hidden="true" className="qsearch__icon" />
        <input
          ref={input} id={`${id}-input`} value={query} placeholder={placeholder} autoComplete="off" spellCheck={false}
          role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined} aria-label={placeholder}
          onFocus={focus} onChange={(e) => { setQuery(e.target.value); setActive(-1); if (!open) setOpen(true); }} onKeyDown={onKey}
        />
        {query
          ? <button type="button" className="qsearch__clear" aria-label="검색어 지우기" onClick={(e) => { e.stopPropagation(); setQuery(""); input.current?.focus(); }}><X size={14} /></button>
          : <kbd className="qsearch__kbd" aria-hidden="true"><b>{isMac ? "⌘" : "Ctrl"}</b><b>K</b></kbd>}
      </div>

      <div className={`qsearch__panel${show ? " is-shown" : ""}`} id={`${id}-list`} role="listbox" aria-label="검색 제안">
        {!term && recent.length > 0 && (
          <div className="qsearch__head">
            <span>최근 검색</span>
            <button type="button" className="text-link" onClick={() => { clearRecentSearches(userId); setRecent([]); input.current?.focus(); }}>전체 삭제</button>
          </div>
        )}
        {items.map((item, index) => {
          const selected = index === active;
          if (item.type === "recommend") {
            const first = index === 0 || items[index - 1].type !== "recommend";
            const Icon = KIND_ICON[item.s.kind];
            return (
              <Fragment key={`c:${item.s.kind}:${item.s.label}`}>
                {first && <div className="qsearch__head qsearch__head--rec"><span>추천 검색어</span><small>{recent.length ? "" : "자주 찾는 시험과 장비가 많은 기관"}</small></div>}
                <div id={`${id}-opt-${index}`} role="option" aria-selected={selected} className={`qsearch__item qsearch__item--rec${selected ? " is-active" : ""}`}
                  onPointerDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}>
                  <Icon size={14} aria-hidden="true" className="qsearch__item-icon" />
                  <span className="qsearch__label"><span>{item.s.label}</span>{item.s.sub && <small>{item.s.sub}</small>}</span>
                  <span className="qsearch__kind">{KIND_LABEL[item.s.kind]}</span>
                </div>
              </Fragment>
            );
          }
          const common = { id: `${id}-opt-${index}`, role: "option", "aria-selected": selected } as const;
          if (item.type === "recent") return (
            <div {...common} key={`r:${item.label}`} className={`qsearch__item${selected ? " is-active" : ""}`}
              onPointerDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}>
              <Clock3 size={14} aria-hidden="true" className="qsearch__item-icon" />
              <span className="qsearch__label"><span>{highlight(item.label, term)}</span></span>
              <button type="button" className="qsearch__remove" aria-label={`${item.label} 최근 검색에서 삭제`}
                onClick={(e) => { e.stopPropagation(); removeRecentSearch(userId, item.label); setRecent(readRecentSearches(userId)); }}>
                <X size={12} />
              </button>
            </div>
          );
          const Icon = KIND_ICON[item.s.kind];
          return (
            <div {...common} key={`s:${item.s.kind}:${item.s.label}`} className={`qsearch__item${selected ? " is-active" : ""}`}
              onPointerDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}>
              <Icon size={14} aria-hidden="true" className="qsearch__item-icon" />
              <span className="qsearch__label"><span>{highlight(item.s.label, term)}</span>{item.s.sub && <small>{item.s.sub}</small>}</span>
              <span className="qsearch__kind">{KIND_LABEL[item.s.kind]}</span>
            </div>
          );
        })}
        {term && (
          <div id={`${id}-opt-all`} role="option" aria-selected={false} className="qsearch__item qsearch__item--all"
            onPointerDown={(e) => e.preventDefault()} onClick={() => run(query)}>
            <Search size={14} aria-hidden="true" className="qsearch__item-icon" />
            <span className="qsearch__label"><span>‘{query.trim()}’ 전체 검색</span></span>
            <span className="qsearch__kind">Enter</span>
          </div>
        )}
      </div>
      {createPortal(<div className={`qsearch-backdrop${open ? " is-shown" : ""}`} aria-hidden="true" />, document.body)}
    </div>
  );
}

function highlight(text: string, term: string): ReactNode {
  if (!term) return text;
  const at = text.toLowerCase().indexOf(term);
  if (at < 0) return text;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + term.length)}</mark>{text.slice(at + term.length)}</>;
}

/** 한글 초성 검색 (예: "ㅇㅈㄱ" → 열진공) */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
function initials(text: string) {
  return [...text].map((ch) => {
    const code = ch.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : ch.toLowerCase();
  }).join("");
}
