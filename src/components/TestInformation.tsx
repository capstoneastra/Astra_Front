import { useState } from "react";
import { Building2, Check, ListChecks, Microscope } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { Badge, PageHeader, Panel } from "./ui/index";
import { useApiQuery } from "../hooks/useApiQuery";
import { catalogService } from "../services/catalogService";
import { testTypeLabel } from "../services/equipmentService";
import { specValue } from "../domain/specValue";
import ApiState from "./ui/ApiState";
import type { TestInfoScope } from "../hooks/useWorkspaceNavigation";
import type { EquipmentSpec } from "../services/contracts";

/**
 * 시험 정보 안내 (명세 기능 4 · GET /test-types/{code})
 *
 * 장비 상세에서 열면(scope) 그 장비가 할 수 있는 시험 종류만 고를 수 있고,
 * 조건 표에 '이 장비 사양'(conditionRules.specKey ↔ 장비 사양 키)을 함께 보여 줍니다.
 * 고른 시험 코드와 응답의 code 가 같을 때만 표를 그려, 다른 시험의 조건이 잠깐이라도 보이지 않게 합니다.
 */

// 서버의 비교 규칙 코드를 사용자가 이해할 수 있는 말로 (명세: MAX_LIMIT·MIN_LIMIT·RANGE_WITHIN·NONE, 데모: LTE·GTE·WITHIN)
const COMPARATOR_LABEL: Record<string, string> = {
  MAX_LIMIT: "장비 최대값 이하여야 함", LTE: "장비 최대값 이하여야 함",
  MIN_LIMIT: "장비 최소값 이상이어야 함", GTE: "장비 최소값 이상이어야 함",
  RANGE_WITHIN: "장비 범위 안에 있어야 함", WITHIN: "장비 범위 안에 있어야 함",
  NONE: "기관이 직접 확인",
};
const VALUE_TYPE: Record<string, string> = { NUMBER: "숫자", RANGE: "범위 (최소~최대)", TEXT: "글" };
const ACCESS: Record<string, string> = { EXTERNAL_ALLOWED: "외부 이용 가능", INTERNAL_ONLY: "기관 내부 전용" };

const won = (n: number) => n.toLocaleString("ko-KR");
function costText(min?: number | null, max?: number | null) {
  if (min != null && max != null && max !== min) return `${won(min)}~${won(max)}원`;
  if (min != null) return `${won(min)}원~`;
  if (max != null) return `~${won(max)}원`;
  return null;
}

/** 같은 키가 실측(REAL)·예시(MOCK) 둘 다 있으면 실측을 씀 */
function findSpec(specs: EquipmentSpec[] | undefined, key: string | null | undefined) {
  if (!key || !specs?.length) return undefined;
  const same = specs.filter((s) => s.key === key);
  return same.find((s) => s.sourceType !== "MOCK") ?? same[0];
}

const Unknown = ({ children = "확인 필요" }: { children?: string }) => <span className="test-info__unknown">{children}</span>;

export default function TestInformation({ scope }: { scope?: TestInfoScope }) {
  const { testTypeCode, setTestTypeCode, resolveEquipment, user } = useWorkspace();
  const allowed = scope?.testTypes?.length ? scope.testTypes : null;
  const [selected, setSelected] = useState(() => {
    const wanted = scope?.code || testTypeCode || "VIBRATION";
    return allowed && !allowed.includes(wanted) ? allowed[0] : wanted;
  });
  const types = useApiQuery((signal) => catalogService.testTypes(signal), "test-types");
  const detail = useApiQuery((signal) => catalogService.testType(selected, signal), `test-type:${selected}`, Boolean(selected));
  // 장비 상세와 같은 키 — 방금 연 장비라 대개 캐시에서 바로 나옴
  const equipment = useApiQuery(
    (signal) => (scope?.equipmentId != null ? resolveEquipment(scope.equipmentId, signal) : undefined),
    `equipment-detail:${user.id}:${scope?.equipmentId}`,
    scope?.equipmentId != null,
  );

  const choices = allowed
    ? allowed.map((code) => ({ code, name: types.data?.find((t) => t.code === code)?.nameKo ?? testTypeLabel(code), count: types.data?.find((t) => t.code === code)?.equipmentCount }))
    : (types.data ?? []).map((t) => ({ code: t.code, name: t.nameKo, count: t.equipmentCount }));
  const info = detail.data?.code === selected ? detail.data : null;
  // 고른 시험과 다른 시험의 안내가 오면 표를 그리지 않고 알림 (잘못된 조건을 안내하지 않도록)
  const mismatch = detail.data && !info
    ? { code: "TEST_TYPE_MISMATCH", message: `고른 시험(${testTypeLabel(selected)})과 다른 시험(${detail.data.nameKo || detail.data.code})의 안내가 왔어요. 다시 불러와 주세요.` }
    : null;
  const rules = info?.conditionRules ?? [];
  const required = rules.filter((r) => r.isRequired).length;
  const specs = equipment.data?.specs;
  const pick = (code: string) => { setSelected(code); setTestTypeCode(code); };

  return (
    <div className="content-page page-enter test-info-page">
      <PageHeader title="시험 정보 안내" description="시험에 필요한 조건과 수행기관을 확인하세요." />

      <Panel className="test-info__pick">
        <div className="test-info__pick-head">
          {scope?.equipmentName ? (
            <>
              <span className="test-info__glyph" aria-hidden="true"><Microscope size={18} /></span>
              <div>
                <strong>{scope.equipmentName}</strong>
                <p>이 장비로 할 수 있는 시험 {choices.length}개 중 하나를 고르세요.</p>
              </div>
            </>
          ) : (
            <div>
              <strong>시험 종류</strong>
              <p>알아볼 시험을 고르세요.</p>
            </div>
          )}
        </div>
        <div className="test-info__types" role="radiogroup" aria-label="시험 종류">
          {choices.map((t) => (
            <button key={t.code} type="button" role="radio" aria-checked={t.code === selected} onClick={() => pick(t.code)}>
              <span className="test-info__type-name">{t.name}</span>
              {t.count != null && <small>등록 장비 {t.count}대</small>}
              {t.code === selected && <span className="test-info__type-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
            </button>
          ))}
        </div>
      </Panel>

      {(types.error || detail.loading || detail.error || mismatch) && (
        <ApiState
          loading={detail.loading}
          error={types.error ?? detail.error ?? mismatch}
          onRetry={() => { types.reload(); detail.reload(); }}
        />
      )}

      {info && (
        <>
          <Panel
            className="test-info__card"
            title={<><ListChecks size={17} aria-hidden="true" /> {info.nameKo} · 입력할 시험조건</>}
            description={rules.length ? `의뢰서에 적는 조건 ${rules.length}개 · 필수 ${required}개` : undefined}
          >
            {info.description && <p className="test-info__desc">{info.description}</p>}
            {rules.length ? (
              <div className="table-scroll">
                <table className="test-info__table">
                  <thead>
                    <tr>
                      <th>조건</th>
                      <th>필수 여부</th>
                      <th>입력 형식</th>
                      <th>장비와 비교하는 방법</th>
                      {scope?.equipmentId != null && <th>이 장비 사양</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => {
                      const spec = findSpec(specs, rule.specKey);
                      return (
                        <tr key={rule.conditionKey}>
                          <td><b>{rule.label}</b></td>
                          <td><Badge tone={rule.isRequired ? "cyan" : undefined}>{rule.isRequired ? "필수" : "선택"}</Badge></td>
                          <td>{VALUE_TYPE[rule.valueType] ?? rule.valueType}{rule.unit ? ` · ${rule.unit}` : ""}</td>
                          <td>{COMPARATOR_LABEL[rule.comparator] ?? "기관 확인"}</td>
                          {scope?.equipmentId != null && (
                            <td>
                              {!rule.specKey || rule.comparator === "NONE" ? <Unknown>비교 안 함</Unknown>
                                : equipment.loading ? <Unknown>불러오는 중</Unknown>
                                : spec ? <>{specValue(spec)}{spec.sourceType === "MOCK" && <> <Badge tone="amber">DEMO</Badge></>}</>
                                : <Unknown>등록된 사양 없음</Unknown>}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="test-info__empty">이 시험은 정해진 입력 조건이 없어요. 의뢰서의 세부 시험조건에 적으면 기관이 확인합니다.</p>
            )}
          </Panel>

          <Panel
            className="test-info__card"
            title={<><Building2 size={17} aria-hidden="true" /> 수행 가능 기관</>}
            description={info.institutions.length ? `이 시험을 할 수 있는 기관 ${info.institutions.length}곳 · 비용·기간은 기관 확인 전 참고값` : undefined}
          >
            {info.institutions.length ? (
              <div className="table-scroll">
                <table className="test-info__table">
                  <thead>
                    <tr>
                      <th>기관</th>
                      <th>지역</th>
                      <th>장비</th>
                      <th>예상 비용</th>
                      <th>소요 기간</th>
                      <th>이용조건</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.institutions.map((org) => {
                      const own = scope?.institutionId != null && org.id === scope.institutionId;
                      const cost = costText(org.estCostMin, org.estCostMax);
                      return (
                        <tr key={org.id} className={own ? "is-own" : undefined}>
                          <td><b>{org.name}</b>{own && <> <Badge tone="cyan">이 장비 보유</Badge></>}</td>
                          <td>{org.region ?? <Unknown />}</td>
                          <td>{org.equipmentCount}대</td>
                          <td>{cost ?? <Unknown />}</td>
                          <td>{org.estDurationDays != null ? `${org.estDurationDays}일~` : <Unknown />}</td>
                          <td>{org.accessScope && ACCESS[org.accessScope] ? ACCESS[org.accessScope] : <Unknown />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="test-info__empty">현재 등록된 수행기관이 없습니다.</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
