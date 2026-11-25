import { useWorkspace } from "../../context/AppContext";
import { equipmentDistribution, requestDistribution } from "../../domain/dashboard";
import { Panel } from "../ui";
import ApiState from "../ui/ApiState";
import DataChart from "./DataChart";

export default function DashboardVisuals() {
  const { user, workspaceView, summaryQuery, catalogQuery, equipmentList } = useWorkspace();
  const own = workspaceView === "PROVIDER";
  const equipment = own ? equipmentList.filter(item => item.institutionId === user.organization?.id) : equipmentList;
  return <div className="dashboard-visuals">
    <Panel title="의뢰 진행 분포" description={own ? "소속 조직이 받은 의뢰 · 상태별 집계" : workspaceView === "ADMIN" ? "전체 의뢰 · 상태별 집계" : "내가 보낸 의뢰 · 상태별 집계"}>
      {summaryQuery.loading || summaryQuery.error ? <ApiState loading={summaryQuery.loading} error={summaryQuery.error} onRetry={summaryQuery.reload} /> : summaryQuery.data?.dataAvailable.requests ? <DataChart label="의뢰 상태별 건수" items={requestDistribution(summaryQuery.data.requestCounts)} /> : <p className="chart-unavailable">의뢰 집계 연동 대기</p>}
    </Panel>
    <Panel title={own ? "보유 장비 가용 현황" : "장비 가용 현황"} description={own ? "소속 조직 보유 장비 · 현재 등록 상태" : "조회된 활성 장비 · 현재 등록 상태"}>
      {catalogQuery.loading || catalogQuery.error ? <ApiState loading={catalogQuery.loading} error={catalogQuery.error} onRetry={catalogQuery.reload} /> : <DataChart kind="bars" unit="대" label="장비 가용 상태별 대수" items={equipmentDistribution(equipment)} />}
    </Panel>
  </div>;
}
