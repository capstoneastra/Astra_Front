import { Activity, Bell, BookOpen, Building2, CalendarDays, ClipboardList, Columns3, Database, MessageSquareText, Microscope, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Badge, Panel } from "./index";
import type { ApiStateProps } from "./ApiState";
import SimulationChart from "../workflow/SimulationChart";
import "../../styles/ui-examples.css";

// Display-only examples. Keep these out of service DTOs, query data and action payloads.
// See docs/ui-examples.md for the display switch and removal checklist.
const examples = {
  equipment: { icon: Microscope, title: "진동시험기", detail: "가상 우주환경시험센터", note: "위성 전장품의 진동 내구성을 확인하는 장비입니다." },
  request: { icon: ClipboardList, title: "위성 전장품 진동시험", detail: "가상 우주환경시험센터 · 보완 요청", note: "시험 조건과 시료 준비 일정을 확인합니다." },
  review: { icon: ClipboardList, title: "위성 전장품 진동시험", detail: "가상 시험 의뢰 · 신규 접수", note: "시료 정보와 요청 조건을 검토합니다." },
  schedule: { icon: CalendarDays, title: "전장품 진동시험", detail: "진동시험기 · 가상 우주환경시험센터", note: "10:00–12:00 · 일정 협의 중" },
  chat: { icon: MessageSquareText, title: "위성 전장품 진동시험 상담", detail: "시험 목적과 장비 조건 정리", note: "최근 상담이 있으면 이어서 열 수 있습니다." },
  matching: { icon: Sparkles, title: "진동시험기 추천 후보", detail: "주파수 범위 확인 · 시료 장착 조건 확인 필요", note: "후보별 충족 조건과 확인이 필요한 조건이 표시됩니다." },
  comparison: { icon: Columns3, title: "사양·이용조건 비교표", detail: "진동시험기 A / 진동시험기 B", note: "예시 비교 항목 · 운용 지원 가능 / 기관 협의" },
  testInfo: { icon: BookOpen, title: "진동시험", detail: "입력할 시험조건 · 주파수 범위, 시료 질량", note: "수행 가능 기관 · 가상 우주환경시험센터" },
  duplicates: { icon: Database, title: "대전 · 진동시험", detail: "진동시험기 A, 진동시험기 B", note: "같은 지역에서 동일 시험을 지원하는 장비의 그룹입니다." },
  managedEquipment: { icon: Database, title: "보유 진동시험기", detail: "가상 우주환경시험센터 · 정보 확인 필요", note: "등록된 장비의 이용 조건과 마지막 확인 상태가 표시됩니다." },
  notification: { icon: Bell, title: "시험 의뢰에 보완 요청이 도착했습니다", detail: "위성 전장품 진동시험", note: "의뢰의 진행 상태나 일정에 변경이 있을 때 표시됩니다." },
  simulation: { icon: Activity, title: "진동시험 시뮬레이션 실행 이력", detail: "진동시험기 · 실행 완료", note: "서버에서 실행한 시뮬레이션 이력이 여기에 표시됩니다." },
  simulationResult: { icon: Activity, title: "가상 시뮬레이션 결과 차트", detail: "화면 구성을 보여주는 임의의 선형 데이터입니다.", note: "실제 실행 결과는 모델과 조건을 선택한 뒤 확인할 수 있습니다." },
  institution: { icon: Building2, title: "가상 우주환경시험센터", detail: "대전 · 진동시험", note: "기관별 시험장비를 찾아볼 수 있습니다." },
  institutionVerification: { icon: ShieldCheck, title: "가상 우주환경시험센터", detail: "장비 정보 검증 진행 중", note: "기관별 검증 완료 장비와 전체 등록 장비를 비교합니다." },
  memberApproval: { icon: Users, title: "가상 기관 담당자", detail: "기관·대학 담당자 · 승인 대기", note: "회원의 신청 정보와 승인 상태가 표시됩니다." },
  organizationApproval: { icon: Building2, title: "가상 우주환경시험센터", detail: "연구기관 · 승인 대기", note: "기관의 등록 정보와 승인 상태가 표시됩니다." },
};

interface UiExampleProps extends Pick<ApiStateProps, "loading" | "error"> {
  kind: keyof typeof examples;
  hasData?: boolean;
  compact?: boolean;
}

export default function UiExample({ kind, hasData = false, loading, error, compact = false }: UiExampleProps) {
  if (import.meta.env.VITE_SHOW_UI_EXAMPLES === "false" || hasData || loading ||
    error?.status === 401 || error?.status === 403) return null;

  const { icon: Icon, title, detail, note } = examples[kind];
  const label = <Badge tone="amber">화면 예시</Badge>;

  if (kind === "simulationResult") {
    return <Panel className="form-panel ui-example" title={title} description={detail} action={label}>
      <SimulationChart chart={{ xLabel: "시간", yLabel: "응답 예시", series: [[0, 0], [1, 3], [2, 2], [3, 4], [4, 1]] }} />
      <p className="field-hint">{note}</p>
    </Panel>;
  }

  if (kind === "comparison") {
    return <Panel className="form-panel ui-example" title={title} action={label}>
      <div className="table-scroll"><table>
        <thead><tr><th scope="col">항목</th><th scope="col">진동시험기 A</th><th scope="col">진동시험기 B</th></tr></thead>
        <tbody><tr><th scope="row">운용 지원</th><td>가능</td><td>기관 협의</td></tr></tbody>
      </table></div>
    </Panel>;
  }

  if (kind === "equipment" && !compact) {
    return <div className="equipment-grid">
      <Panel className="equipment-card ui-example" aria-label="장비 카드 예시">
        <div className="equipment-card__visual">
          {label}
          <Icon size={56} aria-hidden="true" />
          <span className="equipment-card__id">진동시험</span>
        </div>
        <div className="equipment-card__body">
          <h2>{title}</h2>
          <p className="equipment-card__institution"><Building2 size={14} aria-hidden="true" />{detail}</p>
          <div className="equipment-description"><p>{note}</p></div>
        </div>
      </Panel>
    </div>;
  }

  const className = kind === "schedule"
    ? "ui-example schedule-card schedule-card--amber"
    : kind === "request" && !compact ? "ui-example request-card" : "ui-example";
  return <Panel className={`${className} ui-example__item`} aria-label={`${title} 화면 예시`}>
    <Icon className="ui-example__icon" size={20} aria-hidden="true" />
    <div className="ui-example__body">
      <div className="ui-example__heading"><strong>{title}</strong>{label}</div>
      <span>{detail}</span>
      <p>{note}</p>
    </div>
  </Panel>;
}
