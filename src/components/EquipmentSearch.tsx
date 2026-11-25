import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Columns3,
  Info,
  Search as SearchIcon,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import {
  Button,
  EmptyState,
  PageHeader,
  TextLink,
} from "./ui";
import { useApiQuery } from "../hooks/useApiQuery";
import { equipmentService, equipmentView, specLabel, testTypeLabel } from "../services/equipmentService";
import { valueText } from "../domain/constants";
import "../styles/search.css";
import { catalogService } from "../services/catalogService";
import { canAccessMenu } from "../auth/permissions";
import EquipmentDetailDialog from "./EquipmentDetailDialog";
import ApiState from "./ui/ApiState";
import { apiConfig } from "../api/config";

/** API 명세의 장비 유형 (GET /equipment?equipmentType=) */
const EQUIPMENT_TYPES: [string, string][] = [["TEST", "시험"], ["MEASUREMENT", "측정·분석"], ["MANUFACTURING", "제작·가공"], ["SOFTWARE", "소프트웨어"], ["SUPPORT", "지원"]];

/** 지역 여러 개 고르기 — 버튼을 누르면 체크 목록이 펼쳐짐 */
function RegionPicker({ all, value, onChange }: { all: string[]; value: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const label = !value.length ? "지역" : value.length === 1 ? value[0] : `${value[0]} 외 ${value.length - 1}`;
  return (
    <div ref={root} className={`eq-region${open ? " is-open" : ""}`}>
      <button type="button" className={`eq-region__btn${value.length ? " is-set" : ""}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        {label}<ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div className="eq-region__menu" role="group" aria-label="지역 (여러 개 선택)">
          {all.map((r) => (
            <label key={r}><input type="checkbox" checked={value.includes(r)} onChange={() => onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r])} />{r}</label>
          ))}
          {value.length > 0 && <button type="button" onClick={() => onChange([])}>선택 해제</button>}
        </div>
      )}
    </div>
  );
}

export default function EquipmentSearch({
  setActiveMenu,
  initialSearchTerm = "",
  initialInstitutionId = null,
  initialView = null,
  onViewChange,
}) {
  const {
    testCondition,
    setSelectedEquipment,
    setDraftRequestId,
    equipmentList,
    user,
    resolveEquipment,
    comparisonIds,
    setComparisonIds,
    setSimulationEquipmentId,
  } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState(initialView?.searchTerm ?? initialSearchTerm);
  const [queryTerm, setQueryTerm] = useState((initialView?.searchTerm ?? initialSearchTerm).trim());
  // v14: 검색 방식은 고르지 않고 자동 — 입력 중에는 키워드 검색, '15kg 진동시험'처럼 숫자·여러 단어가 든 문장을 [검색]하면 문장 해석 검색
  const [filterType, setFilterType] = useState<"all" | "natural">(initialView?.filterType === "natural" ? "natural" : "all");
  const [institutionId, setInstitutionId] = useState(initialView?.institutionId ?? initialInstitutionId);
  const [page, setPage] = useState(initialView?.page ?? 0);
  const [regions, setRegions] = useState<string[]>(initialView?.regions ?? (initialView?.region ? [initialView.region] : []));
  const [testType, setTestType] = useState(initialView?.testType ?? "");
  const [availabilityFilter, setAvailabilityFilter] = useState(initialView?.availability ?? "");
  const [equipmentType, setEquipmentType] = useState(initialView?.equipmentType ?? "");
  // 공동활용·공인시험 체크박스는 없앰. 예시 데이터는 항상 포함(시연 때 구두로 안내)
  const externalOnly = false;
  const accreditedOnly = false;
  const includeMock = apiConfig.includeMock;
  const [sort, setSort] = useState(initialView?.sort ?? "externalId,asc");
  useEffect(() => {
    // 입력 중인 글자(searchTerm)가 아니라 0.25초 멈춘 뒤의 검색어(queryTerm)만 저장 — 키마다 주소 이동·앱 전체 다시 그리기 방지
    onViewChange?.({ searchTerm: queryTerm, filterType, institutionId, page, regions, testType, availability: availabilityFilter, equipmentType, externalOnly, accreditedOnly, includeMock, sort });
  }, [queryTerm, filterType, institutionId, page, regions, testType, availabilityFilter, equipmentType, externalOnly, accreditedOnly, includeMock, sort, onViewChange]);
  const types = useApiQuery(
    (signal) => catalogService.testTypes(signal),
    "test-types",
  );
  // 사양 이름표(한글) — 실패해도 목록은 그대로 보여 주고 키 이름으로 대신함
  useApiQuery((signal) => equipmentService.specDefinitions(signal), "spec-definitions");
  const [detailEquipment, setDetailEquipment] = useState(null);
  const [selecting, setSelecting] = useState(null);
  const [selectionError, setSelectionError] = useState(null);
  const selectionRequest = useRef(null);
  useEffect(() => () => selectionRequest.current?.abort(), []);
  const institutionShortcut = Boolean(institutionId && equipmentList.some((item) =>
    item.institutionId === institutionId && item.institution === queryTerm));
  useEffect(() => {
    if (filterType === "natural") return; // 문장 검색은 [검색]을 눌렀을 때만
    const timer = setTimeout(() => setQueryTerm(searchTerm.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchTerm, filterType]);
  const filters = { institutionId, region: regions, testType, availability: availabilityFilter, equipmentType, externalOnly, accreditedOnly, includeMock };
  const listQuery = useApiQuery(
    async (signal) => {
      if (filterType === "natural") {
        if (!queryTerm) return { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
        const result = await catalogService.search(queryTerm, signal);
        // 문장 해석 결과에도 같은 필터를 적용
        const items = result.equipment.map(equipmentView).filter((e) =>
          (!regions.length || regions.includes(e.region)) &&
          (!institutionId || e.institutionId === institutionId) &&
          (!testType || e.testTypes.includes(testType)) &&
          (!availabilityFilter || (e.usage?.availability ?? e.availability) === availabilityFilter) &&
          (!equipmentType || e.equipmentType === equipmentType) &&
          (!externalOnly || String(e.usage?.accessScope ?? "").includes("외부")) &&
          (includeMock || !e.isMock));
        return { content: items, page: 0, size: 20, totalElements: items.length, totalPages: items.length ? 1 : 0, interpreted: result.interpreted };
      }
      return equipmentService.list({ q: institutionShortcut ? undefined : queryTerm, page, sort, ...filters }, signal);
    },
    JSON.stringify([user.id, queryTerm, page, sort, filterType, institutionShortcut, filters]),
    true,
    undefined,
    true,
  );
  const filteredEquipment = listQuery.data?.content ?? [];
  const total = listQuery.data?.totalElements ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 0;
  const state = listQuery;
  // 처음 불러올 때만 로딩 화면. 검색어·필터를 바꾸는 동안에는 이전 결과를 흐리게 유지
  const waiting = state.loading;
  const refreshing = state.refreshing || (filterType !== "natural" && searchTerm.trim() !== queryTerm);
  const submitSearch = () => {
    const term = searchTerm.trim();
    const sentence = /\d/.test(term) || term.split(/\s+/).filter(Boolean).length >= 3;
    setFilterType(sentence ? "natural" : "all");
    setQueryTerm(term); setPage(0); setInstitutionId(null);
  };
  const handleSelect = (equip) => {
    setDraftRequestId(null);
    setSelectedEquipment(equip);
    setActiveMenu("reservation");
  };
  const requestEquipment = async (equip) => {
    selectionRequest.current?.abort();
    const controller = new AbortController();
    selectionRequest.current = controller;
    setSelecting(equip.id);
    setSelectionError(null);
    try {
      const detail = await resolveEquipment(equip.id, controller.signal);
      if (!controller.signal.aborted) handleSelect(detail);
    } catch (error) {
      if (!controller.signal.aborted) setSelectionError(error);
    } finally {
      if (!controller.signal.aborted) setSelecting(null);
    }
  };

  const allRegions = useMemo(() => [...new Set(equipmentList.map((e) => e.region).filter(Boolean))].sort((x, y) => x.localeCompare(y, "ko")), [equipmentList]);
  const institutions = useMemo(() => [...new Map(equipmentList.filter((e) => e.institutionId).map((e) => [e.institutionId, e.institution])).entries()]
    .sort((x, y) => String(x[1]).localeCompare(String(y[1]), "ko")), [equipmentList]);
  const popular = [...(types.data ?? [])].filter((t) => (t.equipmentCount ?? 0) > 0)
    .sort((x, y) => (y.equipmentCount ?? 0) - (x.equipmentCount ?? 0)).slice(0, 8);
  const filtersActive = Boolean(regions.length || institutionId || testType || availabilityFilter || equipmentType || externalOnly || accreditedOnly);
  const availability: Record<string, [string, string]> = { AVAILABLE: ["이용 가능", "green"], LIMITED: ["일정 제한", "amber"], MAINTENANCE: ["점검 중", "red"] };
  // 비교 제안: 2대째(이상)를 담은 순간에만 띄움
  const [prompt, setPrompt] = useState(false);
  const [promptHover, setPromptHover] = useState(false);
  const previousCount = useRef(comparisonIds.length);
  useEffect(() => {
    if (comparisonIds.length >= 2 && comparisonIds.length > previousCount.current) setPrompt(true);
    if (comparisonIds.length < 2) setPrompt(false);
    previousCount.current = comparisonIds.length;
  }, [comparisonIds.length]);
  useEffect(() => {
    if (!prompt || promptHover) return;
    const timer = window.setTimeout(() => setPrompt(false), 6000);
    return () => window.clearTimeout(timer);
  }, [prompt, promptHover, comparisonIds.length]);
  const toggleCompare = (id: number) =>
    setComparisonIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 5 ? ids : [...ids, id]));
  const resetFilters = () => {
    setInstitutionId(null); setRegions([]); setTestType(""); setAvailabilityFilter(""); setEquipmentType(""); setPage(0);
  };
  const resetAll = () => { setSearchTerm(""); setQueryTerm(""); setFilterType("all"); resetFilters(); };

  return (
    <div className="content-page page-enter equipment-search-page">
      <PageHeader title="시험장비 검색" />
      {testCondition && (
        <div className="eq-condition">
          <Info size={15} aria-hidden="true" />
          <span><strong>상담에서 정리한 조건</strong>{testCondition}</span>
        </div>
      )}
      {/* v14: 가운데 큰 검색창 + 자주 찾는 시험 + 한 줄 필터 막대 + 결과 줄 */}
      <section className="eq-hero" aria-labelledby="eq-hero-title">
        <h2 id="eq-hero-title">어떤 장비가 필요하세요?</h2>
        <form className="eq-searchbar" role="search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
          <SearchIcon size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor="equipment-query">검색어</label>
          <input id="equipment-query" type="search" autoComplete="off"
            placeholder="장비명·시험항목·기관 또는 '15kg 진동시험'처럼 문장으로 검색"
            value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setFilterType("all"); setPage(0); setInstitutionId(null); }} />
          <button type="submit" className="eq-searchbar__go"><SearchIcon size={15} aria-hidden="true" />검색</button>
        </form>
        {popular.length > 0 && (
          <div className="eq-popular" aria-label="자주 찾는 시험">
            <span>자주 찾는 시험</span>
            {popular.map((t) => (
              <button type="button" key={t.code} aria-pressed={testType === t.code}
                onClick={() => { setTestType(testType === t.code ? "" : t.code); setPage(0); }}>
                {t.nameKo}<b>{t.equipmentCount}</b>
              </button>
            ))}
          </div>
        )}
      </section>
      {/* v16: 필터·결과 줄·장비 목록·페이지를 한 판(eq-board)으로 합침 */}
      <div className={`eq-board${refreshing && !waiting ? " is-refreshing" : ""}`} aria-busy={refreshing || undefined}>
        <div className="eq-filterbar">
          <div className="eq-filterbar__row">
            <label className="sr-only" htmlFor="equipment-test-type">시험 종류</label>
            <select id="equipment-test-type" className={testType ? "is-set" : undefined} value={testType} onChange={(e) => { setTestType(e.target.value); setPage(0); }}>
              <option value="">시험 종류 전체</option>
              {types.data?.map((t) => <option key={t.code} value={t.code}>{t.nameKo}</option>)}
            </select>
            <RegionPicker all={allRegions} value={regions} onChange={(next) => { setRegions(next); setPage(0); }} />
            <label className="sr-only" htmlFor="equipment-availability">가용 상태</label>
            <select id="equipment-availability" className={availabilityFilter ? "is-set" : undefined} value={availabilityFilter} onChange={(e) => { setAvailabilityFilter(e.target.value); setPage(0); }}>
              <option value="">가용 상태 전체</option>
              {Object.entries(availability).map(([code, [label]]) => <option key={code} value={code}>{label}</option>)}
            </select>
            <label className="sr-only" htmlFor="equipment-institution">시험기관</label>
            <select id="equipment-institution" className={`eq-filterbar__wide${institutionId ? " is-set" : ""}`} value={institutionId ?? ""} onChange={(e) => { setInstitutionId(e.target.value ? Number(e.target.value) : null); setPage(0); }}>
              <option value="">시험기관 전체</option>
              {institutions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <label className="sr-only" htmlFor="equipment-kind">장비 유형</label>
            <select id="equipment-kind" className={equipmentType ? "is-set" : undefined} value={equipmentType} onChange={(e) => { setEquipmentType(e.target.value); setPage(0); }}>
              <option value="">장비 유형 전체</option>
              {EQUIPMENT_TYPES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          {types.error && <ApiState error={types.error} onRetry={types.reload} />}
          <div className="results-heading eq-filterbar__result">
            <span>결과 <strong>{waiting || state.error ? "—" : total.toLocaleString("ko-KR")}</strong>대</span>
            {filtersActive && <button type="button" className="eq-filterbar__reset" onClick={resetFilters}>필터 초기화</button>}
            {filterType === "natural" && <small><SlidersHorizontal size={12} /> 문장을 해석해 최대 20개 후보를 보여줍니다</small>}
            <span className="eq-filterbar__tools">
              <button type="button" className="eq-recommend" onClick={() => setActiveMenu("matching")}>
                <Sparkles size={13} aria-hidden="true" />조건으로 추천받기
              </button>
              <label className="sr-only" htmlFor="equipment-sort">정렬</label>
              <select id="equipment-sort" value={sort} disabled={filterType === "natural"} onChange={(e) => { setSort(e.target.value); setPage(0); }}>
                <option value="externalId,asc">등록번호순</option>
                <option value="infoUpdatedAt,desc">최근 갱신순</option>
              </select>
            </span>
          </div>
        </div>
        {waiting || state.error ? (
          <div className="eq-board__state"><ApiState loading={waiting} error={state.error} onRetry={state.reload} /></div>
        ) : filteredEquipment.length ? (
          <div className="eq-list" role="table" aria-label="검색된 시험장비">
            <div className="eq-list__head" role="row">
              <span role="columnheader" className="eq-list__check"><span className="sr-only">비교</span></span>
              <span role="columnheader">장비 · 보유기관</span>
              <span role="columnheader">시험 종류</span>
              <span role="columnheader">상태</span>
              <span role="columnheader">주요 사양</span>
              <span role="columnheader">이용료</span>
              <span role="columnheader"><span className="sr-only">작업</span></span>
            </div>
            {filteredEquipment.map((equip, index) => {
              const inCompare = comparisonIds.includes(equip.id);
              const status = availability[equip.availability ?? equip.usage?.availability ?? ""];
              const own = user.organization?.id != null && equip.institutionId === user.organization.id;
              return (
                <div role="row" className={`eq-row${inCompare ? " is-comparing" : ""}`} key={equip.id} style={{ "--i": Math.min(index, 12) } as CSSProperties}>
                  <span role="cell" className="eq-list__check">
                    <button type="button" className={`eq-check${inCompare ? " is-on" : ""}`} aria-pressed={inCompare}
                      disabled={!inCompare && comparisonIds.length >= 5} onClick={() => toggleCompare(equip.id)}
                      aria-label={`${equip.name} ${inCompare ? "비교함에서 빼기" : "비교함에 담기"}`} title={inCompare ? "비교함에서 빼기" : "비교함에 담기"}>
                      {inCompare ? <Check size={13} aria-hidden="true" /> : <Columns3 size={13} aria-hidden="true" />}
                    </button>
                  </span>
                  <button type="button" role="cell" className="eq-row__title" onClick={() => setDetailEquipment(equip)}>
                    <strong>{equip.name}</strong>
                    <small><Building2 size={12} aria-hidden="true" />{equip.institution || "보유기관 확인 필요"}{equip.region && ` · ${equip.region}`}</small>
                  </button>
                  <span role="cell" className="eq-row__types">
                    {equip.testTypes.length
                      ? equip.testTypes.map((code) => <span key={code} className="type-chip">{testTypeLabel(code)}</span>)
                      : <span className="eq-row__muted" title="시험유형이 연결되지 않은 장비">{(() => { const kind = EQUIPMENT_TYPES.find(([code]) => code === equip.equipmentType)?.[1]; return kind ? `${kind} 장비` : "—"; })()}</span>}
                  </span>
                  <span role="cell" className="eq-row__status">
                    {status ? <span className={`status-chip status-chip--${status[1]}`}><i aria-hidden="true" />{status[0]}</span> : <span className="status-chip">확인 필요</span>}
                  </span>
                  <span role="cell" className="eq-row__specs">
                    {equip.specs?.length ? equip.specs.slice(0, 2).map((spec) => (
                      <span key={spec.key}><small>{specLabel(spec)}</small>{valueText(spec)}</span>
                    )) : <small className="eq-row__desc eq-row__muted" title={equip.reason || undefined}>{equip.reason || "등록된 사양 없음"}</small>}
                  </span>
                  <span role="cell" className="eq-row__fee">{equip.usage?.feeText ?? equip.feeText ?? "기관 문의"}</span>
                  <span role="cell" className="eq-row__actions">
                    <TextLink onClick={() => setDetailEquipment(equip)}>상세</TextLink>
                    <Button icon={ArrowRight} disabled={selecting !== null || own || !canAccessMenu(user.role, "reservation")}
                      title={own ? "소속 기관 장비는 의뢰할 수 없습니다" : undefined} onClick={() => requestEquipment(equip)}>
                      {selecting === equip.id ? "확인 중…" : "의뢰"}
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="eq-board__state">
            <EmptyState icon={SearchIcon} title="일치하는 장비를 찾지 못했어요" description="검색어를 줄이거나 필터를 초기화해 보세요.">
              <Button variant="secondary" onClick={resetAll}>전체 장비 보기</Button>
              {!waiting && (
                <Button variant="ghost" icon={Activity} onClick={() => { setSimulationEquipmentId(null); setActiveMenu("simulation"); }}>가상 시뮬레이션</Button>
              )}
            </EmptyState>
          </div>
        )}
        {!waiting && !state.error && totalPages > 1 && (
          <div className="eq-pager">
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>이전</Button>
            <span>{page + 1} / {totalPages}</span>
            <Button variant="secondary" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>다음</Button>
          </div>
        )}
      </div>
      {selectionError && <ApiState error={selectionError} />}
      {/* v7: 비교함에 2대 이상 담는 순간 아래에 잠깐 떠오르는 제안 — 6초 뒤(마우스를 올리면 멈춤) 사라짐 */}
      {createPortal(<div className={`compare-prompt${prompt ? " is-shown" : ""}`} role="status" aria-live="polite"
        onMouseEnter={() => setPromptHover(true)} onMouseLeave={() => setPromptHover(false)}>
        {prompt && <>
          <span className="compare-prompt__icon" aria-hidden="true"><Columns3 size={16} /></span>
          <span className="compare-prompt__text">
            <strong>{comparisonIds.length === 2 ? "두 장비를 비교할까요?" : `${comparisonIds.length}대를 비교할까요?`}</strong>
            <small>{comparisonIds.map((id) => equipmentList.find((e) => e.id === id)?.name).filter(Boolean).join(" · ")}</small>
          </span>
          <Button icon={Columns3} onClick={() => setActiveMenu("compare")}>비교하기</Button>
          <button type="button" className="icon-button" aria-label="닫기" onClick={() => setPrompt(false)}><X size={15} /></button>
        </>}
      </div>, document.querySelector(".app-shell") ?? document.body)}
      <EquipmentDetailDialog
        item={detailEquipment}
        onClose={() => setDetailEquipment(null)}
        onSelect={handleSelect}
      />
    </div>
  );
}
