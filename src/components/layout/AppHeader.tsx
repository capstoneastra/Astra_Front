import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Command, Info, Menu, Orbit, Search, X } from "lucide-react";
import { menuLabels } from "../../data/navigation";
import { Badge, Button } from "../ui";
import { useAuth } from "../../auth/context";
import { apiConfig } from "../../api/config";
import ThemeToggle from "../ui/ThemeToggle";

export default function AppHeader({ activeMenu, menuOpen, onMenu, onSearch, onBack, canGoBack }) {
  const { user, logout } = useAuth();
  const exitLabel = apiConfig.isPreview ? "미리보기 종료" : "로그아웃";
  const searchDialog = useRef(null);
  const infoDialog = useRef(null);
  const [query, setQuery] = useState("");
  const [date] = useState(() =>
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).format(new Date()),
  );

  useEffect(() => {
    const shortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!searchDialog.current.open) searchDialog.current.showModal();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    searchDialog.current.close();
    onSearch(query.trim());
    setQuery("");
  };

  return (
    <header className="app-header">
      <div className="app-header__location">
        <button type="button" className="icon-button workspace-back" aria-label="이전 화면으로" title="이전 화면으로" disabled={!canGoBack} onClick={onBack}><ArrowLeft size={19} /></button>
        <button
          className="icon-button mobile-menu"
          onClick={onMenu}
          aria-label="메뉴 열기"
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
        >
          <Menu size={21} />
        </button>
        <span className="app-header__workspace">
          {apiConfig.preview ? `미리보기 · ${apiConfig.preview.label}` : "워크스페이스"}
        </span>
        <span className="breadcrumb-separator">/</span>
        <span>{menuLabels[activeMenu]}</span>
      </div>
      <div className="app-header__tools">
        <button
          className="header-search"
          onClick={() => searchDialog.current.showModal()}
        >
          <Search size={15} />
          <span>장비 검색</span>
          <kbd>
            <Command size={10} /> K
          </kbd>
        </button>
        <span className="header-date">{date}</span>
        <span className="header-divider" />
        <ThemeToggle />
        <button
          className="icon-button"
          onClick={() => infoDialog.current.showModal()}
          aria-label="시연 환경 안내"
        >
          <Info size={18} />
        </button>
        <button
          type="button"
          className="user-avatar"
          aria-label={exitLabel}
          title={`${user.name} · ${user.role} · ${exitLabel}`}
          onClick={logout}
        >
          {user.name?.slice(0, 1) || "A"}
        </button>
      </div>
      <dialog
        className="dialog search-dialog"
        ref={searchDialog}
        onClick={(event) => {
          if (event.target === searchDialog.current)
            searchDialog.current.close();
        }}
        aria-labelledby="search-dialog-title"
      >
        <div className="dialog__heading">
          <div>
            <span className="eyebrow">QUICK SEARCH</span>
            <h2 id="search-dialog-title">어떤 장비를 찾고 계신가요?</h2>
          </div>
          <button
            className="icon-button"
            aria-label="검색 닫기"
            onClick={() => searchDialog.current.close()}
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label className="sr-only" htmlFor="global-equipment-query">
            장비명, 시험항목 또는 보유기관
          </label>
          <div className="search-field">
            <Search size={19} />
            <input
              id="global-equipment-query"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="장비명, 시험항목, 보유기관을 입력하세요"
            />
          </div>
          <p className="field-hint">
            장비명·모델·시험항목은 서버 q 검색, 기관은 목록에서 선택하거나 검색
            화면의 기관 필터를 사용합니다.
          </p>
          <Button type="submit" icon={Search}>
            장비 검색하기
          </Button>
        </form>
      </dialog>
      <dialog
        className="dialog"
        ref={infoDialog}
        onClick={(event) => {
          if (event.target === infoDialog.current) infoDialog.current.close();
        }}
        aria-labelledby="info-dialog-title"
      >
        <div className="dialog__heading">
          <span className="dialog__brand">
            <Orbit size={24} />
            ASTRA
          </span>
          <button
            className="icon-button"
            aria-label="안내 닫기"
            onClick={() => infoDialog.current.close()}
          >
            <X size={20} />
          </button>
        </div>
        <Badge tone="cyan" dot>
          {apiConfig.isPreview ? "개발용 미리보기" : apiConfig.isMock ? "개발 전용 Mock · DEMO" : "API 연동 환경"}
        </Badge>
        <h2 id="info-dialog-title">함께 쓰는 장비, 더 넓어지는 가능성</h2>
        <p>
          {apiConfig.isPreview
            ? "장비와 업무 화면을 시연 데이터로 둘러볼 수 있습니다. 입력은 미리보기 페이지의 메모리에 저장됩니다."
            : apiConfig.isMock
              ? "서버 계정으로 로그인하는 MSW 시연 환경입니다. 시연 상담·의뢰·예약은 이 브라우저에 저장됩니다."
              : "실제 API 환경입니다. 서버에서 인증된 역할과 소속을 기준으로 업무를 처리합니다."}
          {!apiConfig.isPreview && " 로그아웃해도 저장된 의뢰 이력은 삭제하지 않습니다."}
        </p>
        <ul className="info-list">
          <li>
            의뢰 제출·기관 검토·예약 확정은 각각 사용자의 확인이 필요합니다.
          </li>
          <li>장비 isMock 또는 MOCK 사양은 DEMO로 구분합니다.</li>
          <li>
            Mock 상담·분석·시뮬레이션은 DEMO이며 실제 AI·시험 결과가 아닙니다.
          </li>
          <li>지도 위치는 예시이며 실제 기관 좌표가 아닙니다.</li>
          <li>AI 자동 추진은 의뢰서 초안까지만 진행합니다.</li>
        </ul>
        <Button variant="secondary" onClick={() => infoDialog.current.close()}>
          확인했어요
        </Button>
      </dialog>
    </header>
  );
}
