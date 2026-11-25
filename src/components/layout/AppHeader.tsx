import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Info, Menu, Orbit, Search, Settings2, X } from "lucide-react";
import { menuLabels } from "../../data/navigation";
import { Badge, Button } from "../ui";
import { useAuth } from "../../auth/context";
import { apiConfig } from "../../api/config";
import ThemeToggle from "../ui/ThemeToggle";
import { useWorkspace } from "../../context/AppContext";

export default function AppHeader({ activeMenu, menuOpen, onMenu, onSearch, onBack, canGoBack, onSettings, parentLabel = undefined }) {
  const { user, logout } = useAuth();
  const { workspaceView } = useWorkspace();
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
          {apiConfig.isPublicDemo ? "공개 DEMO · " : apiConfig.isMock ? "DEMO · " : ""}{apiConfig.preview ? apiConfig.preview.label : workspaceView === "ADMIN" ? "관리자 운영" : workspaceView === "PROVIDER" ? "장비 제공 업무" : "장비 이용 업무"}
        </span>
        <span className="breadcrumb-separator">/</span>
        {parentLabel && <><span className="app-header__parent">{parentLabel}</span><span className="breadcrumb-separator">/</span></>}
        <span>{menuLabels[activeMenu]}</span>
      </div>
      <div className="app-header__tools">
        <span className="header-date">{date}</span>
        <span className="header-divider" />
        <ThemeToggle />
        <button type="button" className="icon-button" onClick={onSettings} aria-label="계정 및 설정" title="계정 및 설정"><Settings2 size={18} /></button>
        <Button className="header-logout" variant="ghost" onClick={logout}>로그아웃</Button>
        <button
          className="icon-button"
          onClick={() => infoDialog.current.showModal()}
          aria-label="플랫폼 안내"
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
          {apiConfig.isPublicDemo ? "공개 시연 DEMO" : apiConfig.isMock ? "개발 전용 DEMO" : apiConfig.isPreview ? "개발용 미리보기" : "API 연동 환경"}
        </Badge>
        <h2 id="info-dialog-title">ASTRA 플랫폼 안내</h2>
        <p>
          {apiConfig.isMock
            ? "DEMO 장비·상담·시뮬레이션은 시연용 응답입니다. 실제 기관 접수·예약 확정·AI 분석이 아닙니다. 입력은 이 브라우저의 별도 DEMO 저장소에 보관됩니다."
            : apiConfig.isPreview
              ? "개발용 화면 미리보기입니다. 업무 데이터는 연결된 서버의 응답으로 표시합니다."
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
          <li>AI 자동 추진은 의뢰서 초안까지만 진행합니다.</li>
        </ul>
        <Button variant="secondary" onClick={() => infoDialog.current.close()}>
          확인했어요
        </Button>
      </dialog>
    </header>
  );
}
