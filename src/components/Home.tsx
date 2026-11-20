import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  Info,
  Layers3,
  Orbit,
  Plus,
  Search,
  Sparkles,
  Telescope,
} from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { Badge, Button, EmptyState, PageHeader, Panel, TextLink } from "./ui";
import InstitutionNetwork from "./dashboard/InstitutionNetwork";
import MetricCard from "./dashboard/MetricCard";
import EquipmentDetailDialog from "./EquipmentDetailDialog";
import ApiState from "./ui/ApiState";
import { canAccessMenu } from "../auth/permissions";

function EquipmentGlyph({ index = 0 }) {
  return (
    <span
      className={`equipment-glyph equipment-glyph--${index % 3}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" fill="none">
        <path d="M7 48h50M12 54h40" stroke="currentColor" opacity=".22" />
        {index % 3 === 0 ? (
          <>
            <path
              d="M13 22h39v25H13zM18 18h29v4M22 22v25M37 22v25"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M26 28h7v12h-7zM41 27h7v7h-7z"
              fill="currentColor"
              opacity=".2"
            />
            <path d="M27 31h5M43 39h4" stroke="currentColor" />
          </>
        ) : index % 3 === 1 ? (
          <>
            <path
              d="M17 15h30v6H17zM19 21v27m26-27v27M16 48h32M26 21v12h12V21M24 38h16v6H24z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M19 33h26v5H19z" fill="currentColor" opacity=".3" />
          </>
        ) : (
          <>
            <path
              d="M14 45h36v5H14zM19 45V19h29v26M24 20v13h17V20M32 33v8M27 41h10"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M24 20h17v13H24z" fill="currentColor" opacity=".16" />
            <circle cx="44" cy="26" r="1.5" fill="currentColor" />
          </>
        )}
      </svg>
    </span>
  );
}

function Distribution({ equipmentList, onSearch, loading, error, onRetry }: import("./ui/ApiState").ApiStateProps & {
  equipmentList: import("../services/equipmentService").Equipment[];
  onSearch: (query: string) => void;
}) {
  const groups = Object.entries(
    equipmentList.reduce<Record<string, number>>((acc, item) => {
      acc[item.testItem || "미분류"] =
        (acc[item.testItem || "미분류"] || 0) + 1;
      return acc;
    }, {}),
  );
  const colors = ["#56d2e2", "#6e8fed", "#a38ae9", "#e6b36e", "#74cba9"];
  let angle = 0;
  const stops = groups.map(([, count], i) => {
    const start = angle;
    angle += (count / equipmentList.length) * 360;
    return `${colors[i % colors.length]} ${start}deg ${angle}deg`;
  });
  return (
    <Panel
      title="시험항목별 장비"
      action={<span className="muted-label">조회 목록 기준</span>}
      className="distribution-panel"
    >
      {loading || error ? (
        <ApiState loading={loading} error={error} onRetry={onRetry} />
      ) : groups.length ? (
        <div className="distribution">
          <div
            className="donut"
            role="img"
            aria-label={`등록 장비 ${equipmentList.length}건의 시험항목 분포`}
            style={{ background: `conic-gradient(${stops.join(",")})` }}
          >
            <div>
              <strong>{equipmentList.length}</strong>
              <span>조회 장비</span>
            </div>
          </div>
          <div className="distribution__legend">
            {groups.map(([name, count], i) => (
              <button key={name} onClick={() => onSearch(name)}>
                <i style={{ background: colors[i % colors.length] }} />
                <span>{name}</span>
                <strong>
                  {count}
                  <small>건</small>
                </strong>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="분석할 장비가 없습니다"
          description="장비를 등록하면 시험항목 분포가 표시됩니다."
        />
      )}
      <div className="panel-footnote">
        <Info size={12} />
        가동률이 아닌 등록 장비의 구성입니다.
      </div>
    </Panel>
  );
}

export default function Home({ setActiveMenu, onSearch }) {
  const {
    equipmentList,
    reservations,
    selectedEquipment,
    setSelectedEquipment,
    testCondition,
    catalogQuery,
    summaryQuery,
    isApiMode,
    isMockMode,
    user,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const summary = summaryQuery.data;
  const requestsAvailable = summary?.dataAvailable.requests === true;
  const requestTotal = requestsAvailable
    ? Object.values(summary.requestCounts).reduce(
        (sum, count) => sum + count,
        0,
      )
    : null;
  const summaryItems =
    user.role === "COMPANY_USER"
      ? (summary?.actionRequired ?? [])
      : user.role === "INSTITUTION_MANAGER"
        ? (summary?.pendingReview ?? [])
        : [];
  const requestStatusLabels: Record<string, string> = {
    DRAFT: "작성 중",
    SUBMITTED: "접수",
    UNDER_REVIEW: "검토 중",
    SUPPLEMENT_REQUESTED: "보완 요청",
    RESUBMITTED: "재제출",
    SCHEDULING: "일정 협의",
    CONFIRMED: "확정",
    COMPLETED: "완료",
    REJECTED: "거절",
    CANCELED: "취소",
  };
  const requestRows = isApiMode
    ? summaryItems.map((item) => ({
        id: item.requestId,
        title: item.title,
        number: item.requestNo,
        institution: summary?.institution?.name || "상세에서 확인",
        date: item.submittedAt?.slice(0, 10) || "확인 필요",
        status: requestStatusLabels[item.status] || item.status,
      }))
    : reservations.map((item) => ({
        id: item.id,
        title: item.equipment?.name,
        number: `#${item.id}`,
        institution: item.equipment?.institution || "기관 정보 없음",
        date: item.hopeDate,
        status: "시연 접수",
      }));
  const institutions = new Set(
    equipmentList.map((item) => item.institution).filter(Boolean),
  ).size;
  const latest = [...equipmentList]
    .sort((a, b) =>
      String(b.updateDate ?? "").localeCompare(String(a.updateDate ?? "")),
    )
    .slice(0, 3);
  const latestDate = latest[0]?.updateDate;
  const openDetail = (item) => {
    setPreview(item);
  };
  const startRequest = (item) => {
    setSelectedEquipment(item);
    setPreview(null);
    setActiveMenu("reservation");
  };

  return (
    <div className="dashboard page-enter">
      <PageHeader
        eyebrow={null}
        title="공동활용 대시보드"
      >
        <Button
          variant="secondary"
          icon={Sparkles}
          onClick={() =>
            setActiveMenu(
              user.role === "COMPANY_USER"
                ? "chatbot"
                : user.role === "ADMIN"
                  ? "admin"
                  : "review",
            )
          }
        >
          {user.role === "COMPANY_USER"
            ? "AI 시험 상담"
            : user.role === "ADMIN"
              ? "회원·기관 승인"
              : "신규 의뢰 검토"}
        </Button>
        <Button
          icon={Plus}
          onClick={() =>
            setActiveMenu(
              user.role === "COMPANY_USER" ? "reservation" : "manager",
            )
          }
        >
          {user.role === "COMPANY_USER" ? "새 시험 의뢰" : "보유 장비 관리"}
        </Button>
      </PageHeader>
      {summaryQuery.error && (
        <Panel>
          <ApiState error={summaryQuery.error} onRetry={summaryQuery.reload} />
        </Panel>
      )}
      <section className="dashboard-search" aria-label="장비 빠른 검색">
        <div className="dashboard-search__label">
          <span className="search-orbit">
            <Telescope size={20} />
          </span>
          <div>
            <strong>어떤 시험을 준비하고 계신가요?</strong>
            <span>필요한 장비와 기관을 한곳에서 찾아보세요.</span>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(query.trim());
          }}
        >
          <label className="sr-only" htmlFor="dashboard-query">
            장비명, 시험항목 또는 기관 검색
          </label>
          <Search size={17} />
          <input
            id="dashboard-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="장비명, 시험항목, 기관 검색"
          />
          <button type="submit">
            검색하기
            <ArrowRight size={15} />
          </button>
        </form>
      </section>
      <div className="metrics-grid">
        <MetricCard
          label="등록 시험장비"
          value={
            isApiMode
              ? (summary?.equipmentStats.total ?? "—")
              : equipmentList.length
          }
          unit="대"
          description="공동활용 장비 목록"
          tag={isMockMode ? "시연 집계" : isApiMode ? "서버 집계" : "샘플"}
          icon={Box}
          onClick={() => setActiveMenu("search")}
        />
        <MetricCard
          label="등록 보유기관"
          value={catalogQuery.status === "ready" ? institutions : "—"}
          unit="곳"
          description="조회된 전체 장비의 보유기관 기준"
          icon={Building2}
          tone="blue"
          onClick={() => {
            document.getElementById("institution-network").scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
              block: "center",
            });
          }}
        />
        <MetricCard
          label={
            user.role === "ADMIN"
              ? "회원 승인 대기"
              : user.role === "INSTITUTION_MANAGER"
                ? "기관 접수 의뢰"
                : "내 시험 의뢰"
          }
          value={
            isApiMode
              ? user.role === "ADMIN"
                ? (summary?.pendingUsers ?? "—")
                : (requestTotal ?? "—")
              : reservations.length
          }
          unit="건"
          description={
            isApiMode
              ? user.role === "ADMIN"
                ? "서버 회원 승인 대기 집계"
                : requestsAvailable
                  ? "서버 의뢰 상태 합계"
                  : "의뢰 집계 준비 중"
              : "현재 세션의 시연 의뢰"
          }
          icon={CalendarDays}
          tone="violet"
          onClick={
            user.role === "ADMIN"
              ? () => setActiveMenu("admin")
              : () => setActiveMenu("reservationCheck")
          }
        />
        <MetricCard
          label={
            user.role === "ADMIN"
              ? "기관 승인 대기"
              : user.role === "INSTITUTION_MANAGER"
                ? "검토 대기 의뢰"
                : "기관 검토·보완"
          }
          value={
            isApiMode && user.role === "ADMIN"
              ? (summary?.pendingInstitutions ?? "—")
              : isApiMode && requestsAvailable
                ? user.role === "COMPANY_USER"
                  ? summary.requestCounts.SUPPLEMENT_REQUESTED
                  : summary.requestCounts.SUBMITTED +
                    summary.requestCounts.RESUBMITTED
                : "—"
          }
          description={
            user.role === "ADMIN"
              ? "서버 기관 승인 대기 집계"
              : requestsAvailable
                ? "서버 상태 집계 기준"
                : "기관 업무 집계 준비 중"
          }
          tag={
            user.role === "ADMIN" || requestsAvailable ? "서버 집계" : "준비 중"
          }
          icon={ClipboardCheck}
          tone="amber"
        />
      </div>
      <div className="dashboard-main-grid">
        <div id="institution-network">
          <InstitutionNetwork
            equipmentList={equipmentList}
            onSearch={onSearch}
            loading={catalogQuery.loading}
            error={catalogQuery.error}
            onRetry={catalogQuery.reload}
          />
        </div>
        <div className="dashboard-right-stack">
          <Panel className="ai-panel">
            <div className="ai-panel__top">
              <span className="ai-label">
                <Sparkles size={14} />
                ASTRA AI
              </span>
              <Badge tone="violet">상담 시연</Badge>
            </div>
            <div className="ai-orbit" aria-hidden="true">
              <span />
              <span />
              <Orbit size={47} strokeWidth={1} />
              <i />
            </div>
            <h2>
              장비를 몰라도,
              <br />
              시험은 시작할 수 있으니까.
            </h2>
            <p>
              필요한 시험을 이야기해 주세요.
              <br />
              AI 상담에서 시험조건을 정리해 보세요.
            </p>
            <button
              className="ai-panel__button"
              onClick={() =>
                setActiveMenu(
                  user.role === "COMPANY_USER"
                    ? "chatbot"
                    : user.role === "ADMIN"
                      ? "admin"
                      : "review",
                )
              }
            >
              {user.role === "COMPANY_USER"
                ? "AI와 시험조건 정리하기"
                : user.role === "ADMIN"
                  ? "회원·기관 승인 확인하기"
                  : "접수된 시험 의뢰 검토하기"}
              <ArrowUpRight size={17} />
            </button>
            <span className="ai-panel__disclaimer">
              {isMockMode
                ? "DEMO 상담·규칙 비교 · 실기관 미전송"
                : "최종 시험 가능 여부는 기관 확인이 필요합니다."}
            </span>
          </Panel>
          <Panel
            title="다음 단계"
            action={<span className="muted-label">빠른 실행</span>}
            className="next-panel"
          >
            <button
              className="next-action"
              disabled={
                selectedEquipment
                  ? !canAccessMenu(user.role, "reservation")
                  : false
              }
              onClick={() =>
                setActiveMenu(selectedEquipment ? "reservation" : "search")
              }
            >
              <span className="next-action__icon">
                <Telescope size={18} />
              </span>
              <span>
                <strong>
                  {selectedEquipment
                    ? "선택한 장비로 의뢰 이어가기"
                    : "내 시험에 맞는 장비 찾기"}
                </strong>
                <small>
                  {selectedEquipment
                    ? selectedEquipment.name
                    : "장비·시험항목·기관으로 탐색"}
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
            <button
              className="next-action"
              onClick={() => setActiveMenu("reservationCheck")}
            >
              <span className="next-action__icon next-action__icon--violet">
                <Layers3 size={18} />
              </span>
              <span>
                <strong>신청한 의뢰 확인하기</strong>
                <small>
                  {isApiMode
                    ? requestsAvailable
                      ? `의뢰 ${requestTotal}건 · 진행 상태 확인`
                      : "의뢰 집계 준비 중"
                    : reservations.length
                      ? `현재 세션에 ${reservations.length}건의 의뢰가 있습니다`
                      : "의뢰 내역을 한곳에서 관리하세요"}
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
            {testCondition && (
              <div className="condition-saved">
                <Check size={13} />
                상담에서 정리한 시험조건이 있습니다.
              </div>
            )}
          </Panel>
        </div>
      </div>
      <Panel
        title={isApiMode ? "확인이 필요한 시험 의뢰" : "내 시험 의뢰 현황"}
        description={
          isApiMode
            ? "진행 중인 시험 의뢰와 다음 업무를 확인하세요."
            : "신청한 시험과 다음 진행 단계를 확인하세요."
        }
        action={
          <TextLink onClick={() => setActiveMenu("reservationCheck")}>
            전체 내역
          </TextLink>
        }
        className="requests-panel"
      >
        {isApiMode && summaryQuery.loading ? (
          <ApiState loading />
        ) : requestRows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{isApiMode ? "시험 의뢰" : "의뢰 장비"}</th>
                  <th scope="col">보유기관</th>
                  <th scope="col">{isApiMode ? "제출일" : "희망 시험일"}</th>
                  <th scope="col">진행 상태</th>
                  <th scope="col">
                    <span className="sr-only">상세</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {requestRows.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.title}
                      </strong>
                      <small>
                        {item.number}
                      </small>
                    </td>
                    <td>
                      {item.institution}
                    </td>
                    <td className="nowrap">
                      {item.date}
                    </td>
                    <td>
                      <Badge tone="amber">
                        {item.status}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`${item.title} 의뢰 내역 보기`}
                        onClick={() => setActiveMenu("reservationCheck")}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="requests-empty">
            <span className="empty-state__icon">
              <FilePlus2 size={23} />
            </span>
            <div>
              <h3>
                {isApiMode
                  ? !requestsAvailable
                    ? "의뢰 데이터 연동 준비 중입니다"
                    : "추가 확인이 필요한 의뢰가 없습니다"
                  : "첫 번째 시험 의뢰를 시작해 보세요"}
              </h3>
              <p>
                {isApiMode
                  ? "전체 내역에서 초안·제출·보완·일정 협의 상태를 확인할 수 있습니다."
                  : "장비를 찾고 의뢰하면 이곳에서 진행 내역을 확인할 수 있습니다."}
              </p>
            </div>
            <Button
              variant="secondary"
              icon={ArrowRight}
              onClick={() => setActiveMenu("search")}
            >
              장비 찾아보기
            </Button>
          </div>
        )}
        <div className="panel-footnote">
          <Info size={12} />
          {isApiMode
            ? "최종 시험 일정은 기관 확인 후 확정됩니다."
            : "현재 시연 접수 내역입니다. 실제 기관 승인 상태는 연동되지 않았습니다."}
        </div>
      </Panel>
      <div className="dashboard-bottom-grid">
        <Panel
          title="최근 갱신 장비"
          action={
            <TextLink onClick={() => setActiveMenu("search")}>
              전체 장비
            </TextLink>
          }
          className="recent-panel"
        >
          {catalogQuery.loading || catalogQuery.error ? (
            <ApiState
              loading={catalogQuery.loading}
              error={catalogQuery.error}
              onRetry={catalogQuery.reload}
            />
          ) : latest.length ? (
            <div className="recent-equipment">
              {latest.map((item, i) => (
                <button
                  key={item.id}
                  className="equipment-row"
                  onClick={() => openDetail(item)}
                >
                  <EquipmentGlyph index={i} />
                  <span className="equipment-row__body">
                    <span className="equipment-row__category">
                      {item.testItem}
                    </span>
                    <strong>{item.name}</strong>
                    <small>{item.institution || "보유기관 미입력"}</small>
                  </span>
                  <span className="equipment-row__end">
                    <span>{item.updateDate}</span>
                    <ArrowUpRight size={15} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="등록된 장비가 없습니다"
              description="장비 데이터 관리에서 장비를 추가해 보세요."
            />
          )}
          <div className="panel-footnote">
            <span className="status-dot" />
            {latestDate
              ? `최신 정보 갱신일 ${latestDate} · ${isApiMode ? "서버 등록 정보 기준" : "장비 샘플 기준"}`
              : "갱신 정보 없음"}
          </div>
        </Panel>
        <Distribution
          equipmentList={equipmentList}
          onSearch={onSearch}
          loading={catalogQuery.loading}
          error={catalogQuery.error}
          onRetry={catalogQuery.reload}
        />
      </div>
      <div className="dashboard-closing">
        <Orbit size={16} />
        <span>함께 쓰는 인프라, 더 넓어지는 우주항공의 가능성.</span>
        <span>ASTRA INFRASTRUCTURE NETWORK</span>
      </div>
      <EquipmentDetailDialog
        item={preview}
        onClose={() => setPreview(null)}
        onSelect={startRequest}
        illustration={<EquipmentGlyph />}
      />
    </div>
  );
}
