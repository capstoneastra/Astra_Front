import { useState } from "react";
import { useWorkspace } from "../context/AppContext";
import { Button, FormField, PageHeader, Panel } from "./ui/index";
import { useApiQuery } from "../hooks/useApiQuery";
import { catalogService } from "../services/catalogService";
import ApiState from "./ui/ApiState";
// 서버의 비교 규칙 코드를 사용자가 이해할 수 있는 말로 (명세: MAX_LIMIT·MIN_LIMIT·RANGE_WITHIN·NONE, 데모: LTE·GTE·WITHIN)
const COMPARATOR_LABEL: Record<string, string> = {
  MAX_LIMIT: "장비 최대값 이하여야 함", LTE: "장비 최대값 이하여야 함",
  MIN_LIMIT: "장비 최소값 이상이어야 함", GTE: "장비 최소값 이상이어야 함",
  RANGE_WITHIN: "장비 범위 안에 있어야 함", WITHIN: "장비 범위 안에 있어야 함",
  NONE: "기관이 직접 확인",
};

export default function TestInformation({ setActiveMenu }) {
  const { testTypeCode, setTestTypeCode } = useWorkspace(),
    [selected, setSelected] = useState(testTypeCode || "VIBRATION");
  const types = useApiQuery(
    (signal) => catalogService.testTypes(signal),
    "test-types",
  );
  const detail = useApiQuery(
    (signal) => catalogService.testType(selected, signal),
    `test-type:${selected}`,
  );
  return (
    <div className="content-page content-page--reading page-enter">
      <PageHeader
        
        title="시험 정보 안내"
        description="시험에 필요한 조건과 수행기관을 확인하세요."
      />
      <Panel className="form-panel">
        <FormField id="information-test-type" label="시험유형">
          <select
            id="information-test-type"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setTestTypeCode(e.target.value);
            }}
          >
            {types.data?.map((t) => (
              <option key={t.code} value={t.code}>
                {t.nameKo} · 장비 {t.equipmentCount}대
              </option>
            ))}
          </select>
        </FormField>
      </Panel>
      {(types.loading || types.error || detail.loading || detail.error) && (
        <ApiState
          loading={types.loading || detail.loading}
          error={types.error ?? detail.error}
          onRetry={() => {
            types.reload();
            detail.reload();
          }}
        />
      )}
      {detail.data && (
        <>
          <Panel
            className="form-panel"
            title={`${detail.data.nameKo} · 입력할 시험조건`}
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>조건</th>
                    <th>필수 여부</th>
                    <th>단위</th>
                    <th>장비와 비교하는 방법</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.conditionRules.map((rule) => (
                    <tr key={rule.conditionKey}>
                      <td>{rule.label}</td>
                      <td>{rule.isRequired ? "필수" : "선택"}</td>
                      <td>{rule.unit ?? "—"}</td>
                      <td>
                        {COMPARATOR_LABEL[rule.comparator] ?? "기관 확인"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <Button onClick={() => setActiveMenu("matching")}>
                조건 분석으로 이어가기
              </Button>
            </div>
          </Panel>
          <Panel className="form-panel" title="수행 가능 기관">
            <div className="table-scroll">
              <table>
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
                  {detail.data.institutions.map((org) => (
                    <tr key={org.id}>
                      <td>{org.name}</td>
                      <td>{org.region ?? "확인 필요"}</td>
                      <td>{org.equipmentCount}대</td>
                      <td>
                        {org.estCostMin != null
                          ? `${org.estCostMin.toLocaleString("ko-KR")}원~`
                          : "확인 필요"}
                      </td>
                      <td>
                        {org.estDurationDays != null
                          ? `${org.estDurationDays}일`
                          : "확인 필요"}
                      </td>
                      <td>
                        {org.accessScope === "EXTERNAL_ALLOWED"
                          ? "외부 이용 가능"
                          : org.accessScope === "INTERNAL_ONLY"
                            ? "기관 내부 전용"
                            : "확인 필요"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!detail.data.institutions.length && (
              <p>현재 등록된 수행기관이 없습니다.</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
