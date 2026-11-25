import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, FileText, Plus, Sparkles, X } from "lucide-react";
import type { HeroFile } from "../../domain/quickPrefill";

/**
 * 대시보드 첫 칸 (v10~v12)
 * - 별·행성 대신 얇은 선으로 그린 도면풍 그림. 색은 한 가지 차분한 강조색만 씁니다.
 * - 그림은 글과 겹치지 않도록 자기 칸(오른쪽)에만 그리고, 입력칸은 아래 가운데 줄에 둡니다.
 * - 기업(내 의뢰): 시험 종류들이 궤도를 따라 도는 위성 + 시험 검색 + AI 간편 의뢰
 * - 기관·대학(장비 운영): 떠다니는 시험 장비들이 등록 카드로 이어지는 그림 + 장비 설명 입력 + AI 간편 등록
 * 그림은 장식이라 화면 읽기 프로그램에서는 숨기고, '움직임 줄이기' 설정을 따릅니다.
 */
/* v12: 2.5D — 비스듬히 기운 궤도(뒤쪽 반은 위성 뒤, 앞쪽 반은 위성 앞)와 등각 투영 큐브위성 */
const C = { x: 220, y: 130 };
const TILT = -14;
const ring = (rx: number, ry: number, tilt: number) => {
  const r = (tilt * Math.PI) / 180;
  const at = (deg: number) => {
    const t = (deg * Math.PI) / 180, x = rx * Math.cos(t), y = ry * Math.sin(t);
    return { x: C.x + x * Math.cos(r) - y * Math.sin(r), y: C.y + x * Math.sin(r) + y * Math.cos(r) };
  };
  const arc = (from: number, to: number) => { const p = at(from), q = at(to); return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} A ${rx} ${ry} ${tilt} 0 1 ${q.x.toFixed(1)} ${q.y.toFixed(1)}`; };
  return { at, back: arc(180, 360), front: arc(0, 180), full: `${arc(0, 180)} ${arc(180, 360).replace(/^M [^A]+/, "")}` };
};
const OUTER = ring(185, 56, TILT);
const INNER = ring(128, 36, 9);
/** 궤도 위 시험 종류와 대표 조건 — "조건을 말하면 맞는 시험을 찾아 준다"는 뜻을 그림으로 */
const TESTS = [
  { label: "진동", cond: "5–2,000 Hz", deg: 222, tone: 1 },
  { label: "열진공", cond: "−40 ~ 70 ℃", deg: 300, tone: 2 },
  { label: "충격", cond: "SRS 2,000 g", deg: 28, tone: 3 },
  { label: "EMC", cond: "30 MHz–1 GHz", deg: 152, tone: 4 },
].map((t) => ({ ...t, ...OUTER.at(t.deg), back: Math.sin((t.deg * Math.PI) / 180) < 0 }));

function TestNode({ t }: { t: (typeof TESTS)[number] }) {
  return (
    <g className={`hero-art__test pt-${t.tone}${t.back ? " is-back" : ""}`}>
      <circle cx={t.x} cy={t.y} r={t.back ? 7.5 : 10} className="hero-art__halo" />
      <circle cx={t.x} cy={t.y} r={t.back ? 3.8 : 5} className="hero-art__dot" />
      <text x={t.x} y={t.back ? t.y - 25 : t.y + 25} textAnchor="middle" className="hero-art__label">{t.label}</text>
      <text x={t.x} y={t.back ? t.y - 12 : t.y + 38} textAnchor="middle" className="hero-art__cond">{t.cond}</text>
    </g>
  );
}

/* 등각 큐브위성: 윗면 (220,100)·(246,115)·(220,130)·(194,115), 높이 30. 태양전지판은 오른쪽 아래(앞)·왼쪽 위(뒤)로 뻗음 */
function IsoSatellite() {
  // 큐브 중심 (220,130). 날개는 큐브 옆면에서 등각 x축(0.866, 0.5) 방향으로 뻗은 '평평한 판'으로 그립니다.
  return (
    <g className="hero-art__float">
      <g transform="translate(220 130) scale(1.32) translate(-220 -130)">
        <g className="hero-art__line">
          {/* 뒤쪽 날개 (큐브 뒤) */}
          <path d="M207 122.5L200.1 118.5" />
          <path d="M211.4 112L149 76L126.4 89L188.8 125Z" className="hero-art__panel" />
          <path d="M195.8 103l-22.6 13M180.2 94l-22.6 13M164.6 85l-22.6 13" className="hero-art__faint" />
          {/* 큐브: 윗면·왼쪽면·오른쪽면 (명암을 달리해 입체감) */}
          <path d="M220 100L246 115L220 130L194 115Z" className="hero-art__face-top" />
          <path d="M194 115L220 130L220 160L194 145Z" className="hero-art__face-left" />
          <path d="M220 130L246 115L246 145L220 160Z" className="hero-art__face-right" />
          <path d="M207 122.5v30M194 130L220 145M233 122.5v30M220 145L246 130M207 107.5L233 122.5M233 107.5L207 122.5" className="hero-art__faint" />
          {/* 안테나 */}
          <path d="M220 115V90" /><circle cx="220" cy="86" r="3" />
          {/* 앞쪽 날개 */}
          <path d="M233 137.5L239.9 141.5" />
          <path d="M251.2 135L313.6 171L291 184L228.6 148Z" className="hero-art__panel" />
          <path d="M266.8 144l-22.6 13M282.4 153l-22.6 13M298 162l-22.6 13" className="hero-art__faint" />
        </g>
        <circle cx="220" cy="115" r="2.6" className="hero-art__accent-fill hero-art__blink" />
      </g>
    </g>
  );
}

function RequestArt() {
  return (
    <svg className="hero-art hero-art--tilt" viewBox="18 18 404 232" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {/* 바닥 그림자 — 위성이 떠 있는 느낌 */}
      <ellipse cx="220" cy="226" rx="74" ry="8" className="hero-art__shadow" />
      {/* 뒤쪽 반 궤도 + 뒤쪽 시험 */}
      <path d={INNER.back} className="hero-art__line hero-art__dash" />
      <path d={OUTER.back} className="hero-art__line hero-art__orbit-back" />
      {TESTS.filter((t) => t.back).map((t) => (
        <path key={`r-${t.label}`} className={`hero-art__line hero-art__ray pt-${t.tone}`} d={`M${C.x + (t.x - C.x) * 0.5} ${C.y + (t.y - C.y) * 0.5} L${t.x} ${t.y}`} />
      ))}
      {TESTS.filter((t) => t.back).map((t) => <TestNode key={t.label} t={t} />)}
      {/* 위성 주변 신호 */}
      <ellipse cx="220" cy="130" rx="44" ry="20" className="hero-art__ping" />
      <ellipse cx="220" cy="130" rx="44" ry="20" className="hero-art__ping" style={{ animationDelay: "-1.6s" }} />
      <IsoSatellite />
      {/* 앞쪽 반 궤도 + 앞쪽 시험 (위성 앞을 지나감) */}
      <path d={INNER.front} className="hero-art__line hero-art__dash" />
      <path d={OUTER.front} className="hero-art__line hero-art__orbit-front" />
      {TESTS.filter((t) => !t.back).map((t) => (
        <path key={`r-${t.label}`} className={`hero-art__line hero-art__ray pt-${t.tone}`} d={`M${C.x + (t.x - C.x) * 0.5} ${C.y + (t.y - C.y) * 0.5} L${t.x} ${t.y}`} />
      ))}
      {TESTS.filter((t) => !t.back).map((t) => <TestNode key={t.label} t={t} />)}
      {/* 궤도를 도는 탐색 점: 앞쪽(0~50%)은 밝게, 뒤쪽(50~100%)은 흐리게 */}
      <circle r="3.5" className="hero-art__comet" style={{ offsetPath: `path("${OUTER.full}")` } as CSSProperties} />
    </svg>
  );
}

const LINKS = [
  { d: "M118 66 C 160 66, 170 104, 196 108", tone: 2 },
  { d: "M110 178 C 150 178, 168 148, 196 140", tone: 1 },
  { d: "M330 70 C 300 74, 296 100, 286 106", tone: 4 },
  { d: "M332 176 C 306 172, 300 150, 286 142", tone: 3 },
];

function RegisterArt() {
  return (
    <svg className="hero-art" viewBox="28 22 374 212" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {/* 장비 → 등록 카드 연결선 + 그 위를 흐르는 색 점 */}
      {LINKS.map((l, i) => (
        <g key={l.d}>
          <path className="hero-art__line hero-art__link" d={l.d} style={{ animationDelay: `${-i * 0.7}s` }} />
          <circle r="2.6" className={`hero-art__packet pt-${l.tone}`} style={{ offsetPath: `path("${l.d}")`, animationDelay: `${-i * 0.9}s` } as CSSProperties} />
        </g>
      ))}
      {/* 가운데 등록 카드 */}
      <g className="hero-art__line">
        <rect x="196" y="88" width="90" height="72" rx="6" className="hero-art__card" />
        <path d="M196 104h90" className="hero-art__faint" />
        <circle cx="205" cy="96" r="2" className="hero-art__accent-fill" /><circle cx="212" cy="96" r="2" className="hero-art__fill" />
        <path d="M206 118h44M206 130h62M206 142h36" className="hero-art__faint" />
        <path d="M262 140l6 6 11-13" className="hero-art__accent hero-art__check" />
      </g>
      {/* 열진공 챔버 */}
      <g className="hero-art__float pt-2" style={{ "--d": "0s" } as CSSProperties}>
        <g className="hero-art__line">
          <rect x="34" y="44" width="84" height="44" rx="22" />
          <ellipse cx="96" cy="66" rx="10" ry="19" className="hero-art__tint" />
          <circle cx="58" cy="66" r="6" className="hero-art__faint" />
          <path d="M48 88v10M104 88v10M42 98h70" />
        </g>
        <text x="76" y="34" textAnchor="middle">열진공 챔버</text>
      </g>
      {/* 진동 가진기 */}
      <g className="hero-art__float pt-1" style={{ "--d": "-2.4s" } as CSSProperties}>
        <g className="hero-art__line">
          <path d="M44 210h66l-8-22H52z" />
          <rect x="58" y="160" width="38" height="28" rx="4" />
          <path d="M52 160h50" />
          <circle cx="66" cy="156" r="1.6" className="hero-art__fill" /><circle cx="77" cy="156" r="1.6" className="hero-art__fill" /><circle cx="88" cy="156" r="1.6" className="hero-art__fill" />
          <path d="M60 150q6-6 12 0t12 0t12 0" className="hero-art__tone hero-art__shake" />
        </g>
        <text x="77" y="226" textAnchor="middle">진동 가진기</text>
      </g>
      {/* EMC 혼 안테나 */}
      <g className="hero-art__float pt-4" style={{ "--d": "-1.3s" } as CSSProperties}>
        <g className="hero-art__line">
          <path d="M330 56l42-18v52l-42-18z" className="hero-art__tint" />
          <rect x="318" y="62" width="12" height="16" rx="2" />
          <path d="M324 78v26M312 104h24" />
          <path d="M384 52q8 12 0 24M392 46q12 18 0 36" className="hero-art__tone hero-art__wave-in" />
        </g>
        <text x="348" y="122" textAnchor="middle">EMC 안테나</text>
      </g>
      {/* 충격 계측 */}
      <g className="hero-art__float pt-3" style={{ "--d": "-3.1s" } as CSSProperties}>
        <g className="hero-art__line">
          <rect x="332" y="150" width="62" height="44" rx="4" />
          <path d="M338 180l8 0 4-18 6 26 5-14 4 6h21" className="hero-art__tone" />
          <path d="M352 194v10M374 194v10M344 204h38" />
        </g>
        <text x="363" y="222" textAnchor="middle">충격 계측</text>
      </g>
    </svg>
  );
}

/* ── v12: 두 입력칸 공통 — '+' 파일 추가 버튼과, 입력칸 왼쪽 위에 붙어 차례로 늘어나는 파일 탭 ── */
const READABLE = /\.(txt|csv|md|json|tsv)$/i;
const MAX_FILES = 5;

/** 장식 그림 칸 — 화면 밖으로 스크롤됐거나 탭이 가려져 있으면 애니메이션을 멈춰 다시 그리는 비용을 없앰 */
function HeroArt({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let visible = true;
    const sync = () => { el.dataset.paused = visible && !document.hidden ? "false" : "true"; };
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); })
      : null;
    observer?.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);
  return <div ref={box} className="hero__art">{children}</div>;
}

function useHeroFiles() {
  const [files, setFiles] = useState<HeroFile[]>([]);
  const add = async (list: FileList | null) => {
    const picked = [...(list ?? [])].slice(0, MAX_FILES - files.length);
    const read = await Promise.all(picked.map(async (f) => ({
      name: f.name, size: f.size,
      text: READABLE.test(f.name) && f.size < 200_000 ? (await f.text()).slice(0, 4000) : undefined,
    })));
    setFiles((current) => [...current, ...read].slice(0, MAX_FILES));
  };
  return { files, add, remove: (i: number) => setFiles((current) => current.filter((_, k) => k !== i)) };
}

function AttachButton({ count, onPick, accept }: { count: number; onPick: (list: FileList | null) => void; accept: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const full = count >= MAX_FILES;
  return (
    <>
      <button type="button" className="hero-input__attach" data-tip={full ? `최대 ${MAX_FILES}개` : "파일 추가"}
        aria-label={full ? `파일은 최대 ${MAX_FILES}개까지 추가할 수 있어요` : "파일 추가"} disabled={full} onClick={() => picker.current?.click()}>
        <Plus size={18} />
      </button>
      <input ref={picker} type="file" hidden multiple accept={accept} onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
    </>
  );
}

function FileTabs({ files, onRemove, hint }: { files: HeroFile[]; onRemove: (i: number) => void; hint?: string }) {
  if (!files.length) return null;
  return (
    <ul className="hero-files" aria-label="추가한 파일">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className={f.text == null ? "is-name-only" : undefined}
          title={f.text == null ? `${f.name} — 내용 읽기는 txt·csv·md·json·tsv만 지원해요. 주요 내용을 글로 적어 주세요.` : f.name}>
          <FileText size={12} aria-hidden="true" /><span>{f.name}</span>
          <button type="button" aria-label={`${f.name} 빼기`} onClick={() => onRemove(i)}><X size={11} /></button>
        </li>
      ))}
      {hint && <li className="hero-files__hint" aria-hidden="true">{hint}</li>}
    </ul>
  );
}

export function RequestHero({ popular, onSearch, onAiRequest }: {
  popular: { code: string; nameKo: string }[];
  onSearch: (query: string, options?: { testType?: string }) => void;
  onAiRequest: (text: string, files: HeroFile[]) => void;
}) {
  const [query, setQuery] = useState("");
  const { files, add, remove } = useHeroFiles();
  return (
    <section className="hero hero--request" aria-labelledby="hero-request-title">
      <div className="hero__copy">
        <span className="hero__eyebrow">ASTRA · 시험 의뢰</span>
        <h2 id="hero-request-title">어떤 시험이 필요하세요?</h2>
        <p>시험 이름·장비·조건으로 찾거나, 말로 설명하면 AI가 조건·장비·의뢰서까지 차례로 도와 드려요.</p>
      </div>
      <HeroArt><RequestArt /></HeroArt>
      <div className="hero__dock">
        <form className="hero-input" role="search" onSubmit={(e) => { e.preventDefault(); onSearch(query.trim()); }}>
          <FileTabs files={files} onRemove={remove} hint="AI 간편 의뢰에 함께 전달돼요" />
          <AttachButton count={files.length} onPick={(l) => void add(l)} accept=".txt,.csv,.md,.json,.tsv,.pdf,.hwp,.hwpx,.doc,.docx,.xlsx" />
          <label htmlFor="hero-search" className="sr-only">시험 검색</label>
          <input id="hero-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예: 큐브위성 진동 시험, 열진공 -40~70℃" autoComplete="off" />
          <button type="submit" className="hero-input__go" aria-label="검색"><ArrowRight size={17} /></button>
        </form>
        <button type="button" className="hero-ai" onClick={() => onAiRequest(query.trim(), files)} title="AI 간편 의뢰 — 조건 정하기 → 장비 고르기 → 의뢰서 쓰기">
          <Sparkles size={16} aria-hidden="true" />AI 간편 의뢰
        </button>
      </div>
      {popular.length > 0 && (
        <div className="hero__chips" aria-label="자주 찾는 시험">
          <span>자주 찾는 시험</span>
          {popular.map((t) => <button type="button" key={t.code} onClick={() => onSearch("", { testType: t.code })}>{t.nameKo}</button>)}
        </div>
      )}
    </section>
  );
}


export function RegisterHero({ stats, onRegister, onOpenManager }: {
  stats: { total: number; stale: number };
  onRegister: (text: string) => void;
  onOpenManager: (staleOnly: boolean) => void;
}) {
  const [text, setText] = useState("");
  const { files, add, remove } = useHeroFiles();
  // 입력한 글 + 읽을 수 있는 첨부 파일 내용을 합쳐 AI(현재는 규칙 기반)에 넘깁니다.
  const submit = () => onRegister([text.trim(), ...files.map((f) => f.text ?? "")].filter(Boolean).join("\n"));
  return (
    <section className="hero hero--register" aria-labelledby="hero-register-title">
      <div className="hero__copy">
        <span className="hero__eyebrow">ASTRA · 장비 등록</span>
        <h2 id="hero-register-title">새 장비를 등록하세요</h2>
        <p>장비 이름·모델·사양을 적거나 사양서를 추가하면, AI가 등록 양식을 채워 드려요.</p>
        <div className="hero__stats">
          <button type="button" onClick={() => onOpenManager(false)}>보유 장비 <b>{stats.total}</b></button>
          <button type="button" className={stats.stale ? "is-warn" : undefined} onClick={() => onOpenManager(true)}>정보 갱신 필요 <b>{stats.stale}</b></button>
        </div>
      </div>
      <HeroArt><RegisterArt /></HeroArt>
      <div className="hero__dock">
        {/* v12: 여러 줄 입력칸이 포커스 때 늘어나 그림·문구를 밀던 문제 → 시험 검색칸과 같은 한 줄 입력칸 */}
        <form className="hero-input" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <FileTabs files={files} onRemove={remove} />
          <AttachButton count={files.length} onPick={(l) => void add(l)} accept=".txt,.csv,.md,.json,.tsv,.pdf,.hwp,.hwpx,.doc,.docx" />
          <label htmlFor="hero-register" className="sr-only">장비 설명</label>
          <input id="hero-register" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off"
            placeholder="예: 열진공 챔버 Ø3.5m, -180~150℃, 모델 TVAC-3500" />
          <button type="submit" className="hero-input__go" aria-label="입력한 내용으로 등록 양식 채우기"><ArrowRight size={17} /></button>
        </form>
        <button type="button" className="hero-ai" onClick={submit}
          title={text.trim() || files.length ? "입력한 내용으로 등록 양식을 채웁니다" : "빈 등록 양식을 엽니다"}>
          <Sparkles size={16} aria-hidden="true" />AI 간편 등록
        </button>
      </div>
    </section>
  );
}
