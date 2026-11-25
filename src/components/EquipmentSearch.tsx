import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Info,
  Microscope,
  Search as SearchIcon,
  Columns3,
  LayoutGrid,
  List,
} from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  PageHeader,
  Panel,
  TextLink,
} from "./ui";
import { useApiQuery } from "../hooks/useApiQuery";
import { equipmentService, equipmentView } from "../services/equipmentService";
import { catalogService } from "../services/catalogService";
import { canAccessMenu } from "../auth/permissions";
import EquipmentDetailDialog from "./EquipmentDetailDialog";
import ApiState from "./ui/ApiState";
import EquipmentStatus from "./workflow/EquipmentStatus";

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
    equipmentList,
    catalogQuery,
    isApiMode,
    user,
    resolveEquipment,
    comparisonIds,
    setComparisonIds,
  } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState(initialView?.searchTerm ?? initialSearchTerm);
  const [displayMode, setDisplayMode] = useState(() => { try { return localStorage.getItem("astra.equipment-view.v1") === "cards" ? "cards" : "list"; } catch { return "list"; } });
  const [queryTerm, setQueryTerm] = useState((initialView?.searchTerm ?? initialSearchTerm).trim());
  const [filterType, setFilterType] = useState(initialView?.filterType ?? "all");
  const [institutionId, setInstitutionId] = useState(initialView?.institutionId ?? initialInstitutionId);
  const [page, setPage] = useState(initialView?.page ?? 0);
  const [region, setRegion] = useState(initialView?.region ?? ""),
    [testType, setTestType] = useState(initialView?.testType ?? "");
  useEffect(() => {
    onViewChange?.({ searchTerm, filterType, institutionId, page, region, testType });
  }, [searchTerm, filterType, institutionId, page, region, testType, onViewChange]);
  const types = useApiQuery(
    (signal) => catalogService.testTypes(signal),
    "test-types",
  );
  const [preview, setPreview] = useState(null);
  const [selecting, setSelecting] = useState(null);
  const [selectionError, setSelectionError] = useState(null);
  const selectionRequest = useRef(null);
  useEffect(() => () => selectionRequest.current?.abort(), []);
  const serverSearch = isApiMode && ["all", "natural"].includes(filterType);
  const institutionShortcut = Boolean(institutionId && equipmentList.some((item) =>
    item.institutionId === institutionId && item.institution === queryTerm));
  useEffect(() => {
    const timer = setTimeout(() => setQueryTerm(searchTerm.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const listQuery = useApiQuery(
    async (signal) => {
      if (filterType === "natural") {
        if (!queryTerm)
          return {
            content: [],
            page: 0,
            size: 20,
            totalElements: 0,
            totalPages: 0,
          };
        const result = await catalogService.search(queryTerm, signal);
        const items = result.equipment
          .map(equipmentView)
          .filter(
            (e) =>
              (!region || e.region === region) &&
              (!institutionId || e.institutionId === institutionId) &&
              (!testType || e.testTypes.includes(testType)),
          );
        return {
          content: items,
          page: 0,
          size: 20,
          totalElements: items.length,
          totalPages: items.length ? 1 : 0,
          interpreted: result.interpreted,
        };
      }
      return equipmentService.list(
        {
          q: institutionShortcut ? undefined : queryTerm,
          institutionId,
          page,
          region,
          testType,
        },
        signal,
      );
    },
    JSON.stringify([
      user.id,
      queryTerm,
      institutionId,
      page,
      region,
      testType,
      filterType,
      institutionShortcut,
    ]),
    serverSearch,
  );
  const localResults = equipmentList.filter((item) => {
    if (
      (region && item.region !== region) ||
      (institutionId && item.institutionId !== institutionId) ||
      (testType && !item.testTypes.includes(testType))
    )
      return false;
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    if (filterType === "name") return item.name.toLowerCase().includes(term);
    if (filterType === "testItem")
      return `${item.testItem} ${item.testTypes?.join(" ") ?? ""}`
        .toLowerCase()
        .includes(term);
    if (filterType === "institution")
      return item.institution.toLowerCase().includes(term);
    return [item.name, item.testItem, item.institution]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
  const filteredEquipment = serverSearch
    ? (listQuery.data?.content ?? [])
    : localResults.slice(page * 20, (page + 1) * 20);
  const total = serverSearch
    ? (listQuery.data?.totalElements ?? 0)
    : localResults.length;
  const totalPages = serverSearch
    ? (listQuery.data?.totalPages ?? 0)
    : Math.ceil(localResults.length / 20);
  const state = serverSearch ? listQuery : catalogQuery;
  const waiting =
    state.loading || (serverSearch && searchTerm.trim() !== queryTerm);
  const handleSelect = (equip) => {
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

  return (
    <div className="content-page page-enter equipment-search-page">
      <PageHeader
        eyebrow={null}
        title="시험장비 검색"
      >
        <Button variant="secondary" icon={Columns3} onClick={() => setActiveMenu("compare")}>선택 장비 비교{comparisonIds.length ? ` · ${comparisonIds.length}` : ""}</Button>
      </PageHeader>
      {testCondition && (
        <div className="content-note">
          <Info size={16} />
          <div>
            <strong>상담에서 정리한 시험조건</strong>
            <p>{testCondition}</p>
            <p className="field-hint">
              추출된 조건은 직접 확인한 뒤 분석·매칭 화면에서 보완할 수
              있습니다.
            </p>
          </div>
          {canAccessMenu(user.role, "matching") && (
            <Button
              variant="secondary"
              onClick={() => setActiveMenu("matching")}
            >
              조건 분석·매칭
            </Button>
          )}
        </div>
      )}
      <Panel className="search-toolbar">
        <label className="sr-only" htmlFor="equipment-filter">
          검색 기준
        </label>
        <select
          id="equipment-filter"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(0);
            setInstitutionId(null);
          }}
        >
          <option value="all">전체 검색</option>
          <option value="natural">자연어·시험항목 검색</option>
          <option value="name">장비명</option>
          <option value="testItem">시험항목</option>
          <option value="institution">보유기관</option>
        </select>
        <label className="sr-only" htmlFor="equipment-query">
          검색어
        </label>
        <div className="search-field">
          <SearchIcon size={18} />
          <input
            id="equipment-query"
            type="search"
            placeholder="장비명, 시험항목, 기관을 검색하세요"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
              setInstitutionId(null);
            }}
          />
        </div>
      </Panel>
      <Panel className="form-panel search-filters">
        <details open>
          <summary>지역·기관·시험유형 필터</summary>
          <div className="form-grid">
            <FormField id="equipment-region" label="지역">
              <select
                id="equipment-region"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">전체 지역</option>
                {[
                  ...new Set(
                    equipmentList.map((e) => e.region).filter(Boolean),
                  ),
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </FormField>
            <FormField id="equipment-institution" label="보유기관">
              <select
                id="equipment-institution"
                value={institutionId ?? ""}
                onChange={(e) => {
                  setInstitutionId(
                    e.target.value ? Number(e.target.value) : null,
                  );
                  setPage(0);
                }}
              >
                <option value="">전체 기관</option>
                {[
                  ...new Map(
                    equipmentList
                      .filter((e) => e.institutionId)
                      .map((e) => [e.institutionId, e.institution]),
                  ).entries(),
                ].map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="equipment-test-type" label="시험유형">
              <select
                id="equipment-test-type"
                value={testType}
                onChange={(e) => {
                  setTestType(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">전체 시험유형</option>
                {types.data?.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.nameKo}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          {types.error && (
            <ApiState error={types.error} onRetry={types.reload} />
          )}
        </details>
      </Panel>
      <div className="results-heading">
        <span>
          검색 결과<strong>{waiting || state.error ? "—" : total}</strong>건
        </span>
        {comparisonIds.length > 0 && <button type="button" className="text-link" onClick={() => setActiveMenu("compare")}>{comparisonIds.length}대 비교하기</button>}
        <div className="equipment-view-switch" aria-label="검색 결과 표시 방식">{[{ mode: "list", label: "목록", icon: List }, { mode: "cards", label: "카드", icon: LayoutGrid }].map(({ mode, label, icon: Icon }) => <button type="button" key={mode} aria-pressed={displayMode === mode} onClick={() => { setDisplayMode(mode); try { localStorage.setItem("astra.equipment-view.v1", mode); } catch { /* Optional preference. */ } }}><Icon size={16} />{label}</button>)}</div>
      </div>
      {waiting || state.error ? (
        <Panel>
          <ApiState
            loading={waiting}
            error={state.error}
            onRetry={state.reload}
          />
        </Panel>
      ) : filteredEquipment.length ? (
        <div className={`equipment-grid equipment-results--${displayMode}`} role="list" aria-label="장비 검색 결과">
          {displayMode === "list" && <div className="equipment-list-columns" role="presentation" aria-hidden="true"><span>장비명·보유기관</span><span>시험유형</span><span>상태·정보 갱신</span><span>작업</span></div>}
          {filteredEquipment.map((equip) => (
            <Panel className="equipment-card" key={equip.id} role="listitem">
              {displayMode === "cards" && <div className="equipment-card__visual">
                <Badge tone="cyan">
                  {equip.testItem || "시험항목 확인 필요"}
                </Badge>
                <Microscope size={56} aria-hidden="true" />
                <span className="equipment-card__id">
                  {equip.externalId ||
                    `#${equip.id}`}
                  {equip.isMock && " · DEMO"}
                </span>
              </div>}
              <div className="equipment-card__body">
                <div className="equipment-card__identity">
                <h2>{displayMode === "list" ? <button type="button" className="equipment-name-link" onClick={() => setPreview(equip)}>{equip.name}</button> : equip.name}</h2>
                <p className="equipment-card__institution">
                  <Building2 size={14} />
                  {equip.institution || "보유기관 확인 필요"}
                </p>
                {displayMode === "list" && <div className="equipment-list-meta"><span>{equip.externalId || `#${equip.id}`}</span>{equip.region && <span>{equip.region}</span>}{equip.isMock && <Badge tone="amber">DEMO</Badge>}</div>}
                </div>
                {displayMode === "list" && <div className="equipment-list-test"><span className="sr-only">시험유형: </span>{equip.testItem || "시험유형 확인 필요"}</div>}
                <EquipmentStatus equipment={equip} showTestType={displayMode !== "list"} />
                {displayMode === "cards" && <div className="equipment-description">
                  <span>장비 활용 설명 · 등록 정보</span>
                  <p>
                    {equip.reason ||
                      "상세보기에서 사양과 이용조건을 확인해주세요."}
                  </p>
                  <small>정보 갱신일 {equip.updateDate || "확인 필요"}</small>
                </div>}
                <div className="equipment-card__footer">
                  <label className="comparison-select"><input type="checkbox" aria-label={`${equip.name} 비교 선택`} checked={comparisonIds.includes(equip.id)} disabled={!comparisonIds.includes(equip.id) && comparisonIds.length >= 5} onChange={(event) => setComparisonIds(event.target.checked ? [...comparisonIds, equip.id] : comparisonIds.filter((id) => id !== equip.id))} />비교 선택</label>
                  <TextLink aria-label={`${equip.name} 상세보기`} onClick={() => setPreview(equip)}>
                    상세보기
                  </TextLink>
                  <Button
                    icon={ArrowRight}
                    disabled={
                      selecting !== null ||
                      equip.institutionId === user.organization?.id ||
                      !canAccessMenu(user.role, "reservation")
                    }
                    onClick={() => requestEquipment(equip)}
                  >
                    {equip.institutionId === user.organization?.id ? "소속 조직 장비" : selecting === equip.id ? "장비 확인 중…" : "시험 의뢰하기"}
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            icon={SearchIcon}
            title="일치하는 장비를 찾지 못했어요"
            description="다른 검색어나 검색 기준으로 다시 찾아보세요."
          >
            <Button
              variant="secondary"
              onClick={() => {
                setSearchTerm("");
                setQueryTerm("");
                setFilterType("all");
                setInstitutionId(null);
                setRegion("");
                setTestType("");
                setPage(0);
              }}
            >
              전체 장비 보기
            </Button>
          </EmptyState>
        </Panel>
      )}
      {!waiting && !state.error && totalPages > 1 && (
        <div className="form-actions">
          <Button
            variant="secondary"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            이전 페이지
          </Button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음 페이지
          </Button>
        </div>
      )}
      {selectionError && <ApiState error={selectionError} />}
      <EquipmentDetailDialog
        item={preview}
        onClose={() => setPreview(null)}
        onSelect={handleSelect}
      />
    </div>
  );
}
