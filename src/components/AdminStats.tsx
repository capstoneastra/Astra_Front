import { useState } from "react";
import { useWorkspace } from "../context/AppContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { dashboardService } from "../services/dashboardService";
import { PageHeader } from "./ui";
import ApiState from "./ui/ApiState";
import BarChart from "./dashboard/BarChart";
import { Pipeline, Section, Skeleton } from "./dashboard/DashboardParts";
import { useAdminInsights } from "./dashboard/AdminInsights";
import { AvailabilityMix, BusiestEquipment, InstitutionLoad, MonthlyTrend, OpsKpis, WaitingRequests } from "./dashboard/OpsStats";
import RequestDetailDialog from "./workflow/RequestDetailDialog";

/**
 * 관리자 운영 통계 (사이드바 > 운영 관리 > 운영 통계)
 * 대시보드는 '오늘 처리할 일'만, 이 화면은 '플랫폼이 어떻게 돌아가는지' 판단하는 데 필요한 것만 둡니다.
 *  - 숫자 요약: 전체 의뢰 · 이번 달 접수 · 반려·취소율 · 회원
 *  - 의뢰 흐름: 월별 접수 추이 · 지금 단계별 현황 · 오래 기다리는 의뢰 · 기관별 처리 현황
 *  - 장비: 가용 상태 · 가동률 높은 장비 · 장비가 부족한 시험 분야 · 지역별 등록 장비
 */
export default function AdminStats() {
  const { user } = useWorkspace();
  const summary = useApiQuery((signal) => dashboardService.summary(user, "ADMIN", signal), `summary:${user.id}:none:ADMIN`);
  const { types, requests, catalogQuery, demandBars, top, regionBars } = useAdminInsights();
  const [opened, setOpened] = useState<number | null>(null);

  const counts = summary.data?.dataAvailable.requests ? summary.data.requestCounts : null;

  return (
    <div className="content-page page-enter admin-stats">
      <PageHeader title="운영 통계" description="플랫폼의 의뢰 흐름과 장비 수급 상황을 확인합니다." />
      <OpsKpis />

      <p className="ops-group">의뢰 흐름</p>
      <div className="dash-grid dash-grid--insights">
        <MonthlyTrend />
        <Section title="지금 단계별 의뢰" className="dash-chart">
          <p className="dash-chart__caption">한 단계에 몰려 있으면 그 단계의 처리가 늦어지고 있는 것입니다.</p>
          {summary.loading ? <Skeleton rows={1} /> : summary.error ? <ApiState error={summary.error} onRetry={summary.reload} /> : (
            <Pipeline counts={counts} audience="admin" />
          )}
        </Section>
        <WaitingRequests onOpen={setOpened} />
        <InstitutionLoad />
      </div>

      <p className="ops-group">장비</p>
      <div className="dash-grid dash-grid--insights">
        <AvailabilityMix />
        <BusiestEquipment />
        <Section title="장비가 부족한 시험 분야" className="dash-chart">
          <p className="dash-chart__caption">장비 1대당 접수 의뢰 수. <b>높을수록 장비가 부족한 분야</b>입니다.</p>
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

      {opened && <RequestDetailDialog key={opened} requestId={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
