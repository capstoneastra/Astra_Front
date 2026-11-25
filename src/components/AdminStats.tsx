import { useWorkspace } from "../context/AppContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { dashboardService } from "../services/dashboardService";
import { PageHeader } from "./ui";
import ApiState from "./ui/ApiState";
import BarChart from "./dashboard/BarChart";
import { Pipeline, Section, Skeleton } from "./dashboard/DashboardParts";
import { useAdminInsights } from "./dashboard/AdminInsights";

/**
 * 관리자 운영 통계 (사이드바 > 운영 관리 > 운영 통계)
 * 대시보드는 '오늘 처리할 일'만, 이 화면은 '플랫폼이 어떻게 돌아가는지' 판단하는 데 필요한 것만 둡니다.
 * 1) 의뢰 진행 현황 — 어느 단계에서 의뢰가 쌓이는지
 * 2) 시험 종류별 장비 1대당 의뢰 수 — 장비가 부족한 분야 (공동활용 확대·기관 유치 판단)
 * 3) 지역별 등록 장비 — 공동활용 장비가 적은 지역
 */
export default function AdminStats() {
  const { user } = useWorkspace();
  const summary = useApiQuery((signal) => dashboardService.summary(user, "ADMIN", signal), `summary:${user.id}:none:ADMIN`);
  const { types, requests, catalogQuery, demandBars, top, regionBars } = useAdminInsights();

  const counts = summary.data?.dataAvailable.requests ? summary.data.requestCounts : null;

  return (
    <div className="content-page page-enter admin-stats">
      <PageHeader title="운영 통계" description="플랫폼의 의뢰 흐름과 장비 수급 상황을 확인합니다." />
      <Section title="의뢰 진행 현황" className="dash-chart">
        <p className="dash-chart__caption">전체 의뢰가 지금 어느 단계에 있는지 보여줍니다. 한 단계에 몰려 있으면 해당 단계의 처리 지연을 확인하세요.</p>
        {summary.loading ? <Skeleton rows={1} /> : summary.error ? <ApiState error={summary.error} onRetry={summary.reload} /> : (
          <Pipeline counts={counts} audience="admin" />
        )}
      </Section>
      <div className="dash-grid dash-grid--insights">
        <Section title="장비 1대당 의뢰 수 · 시험 종류별" className="dash-chart">
          <p className="dash-chart__caption">접수된 의뢰 ÷ 등록 장비. <b>높을수록 장비가 부족한 분야</b>입니다.</p>
          {types.loading || requests.loading ? <Skeleton rows={4} /> : requests.error ? <ApiState error={requests.error} onRetry={requests.reload} /> : (
            <BarChart rows={demandBars.slice(0, 8)} max={top} ariaLabel="시험 종류별 장비 1대당 의뢰 수" empty="아직 집계할 의뢰가 없습니다." />
          )}
        </Section>
        <Section title="지역별 등록 장비" className="dash-chart">
          <p className="dash-chart__caption">공동활용 장비가 적은 지역은 기관 유치·장비 등록 안내가 필요합니다.</p>
          {catalogQuery.loading ? <Skeleton rows={4} /> : (
            <BarChart rows={regionBars} ariaLabel="지역별 등록 장비 수" empty="등록된 장비가 없습니다." />
          )}
        </Section>
      </div>
    </div>
  );
}
