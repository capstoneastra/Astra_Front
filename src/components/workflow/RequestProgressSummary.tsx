import { FileCheck2, CalendarDays, PackageCheck, Wallet } from "lucide-react";
import type { RequestDetail } from "../../services/contracts";
import { apiConfig } from "../../api/config";
import { Badge } from "../ui";
import { requestStatusLabels } from "../../domain/constants";

export default function RequestProgressSummary({ request }: { request: RequestDetail }) {
  const c = request.revision.content;
  const confirmed = request.reservations?.find(r => r.status === "CONFIRMED");
  const safeReportUrl = (() => { try { const u = new URL(request.result?.reportUrl ?? ""); return ["http:", "https:"].includes(u.protocol) ? u.href : null; } catch { return null; } })();
  const fee = request.estimatedFee;
  return <section className="request-progress-summary" aria-labelledby="request-progress-title">
    <header><h3 id="request-progress-title">시험 진행 한눈에</h3>{apiConfig.isMock && <Badge tone="amber">DEMO</Badge>}</header>
    <div className="request-progress-grid">
      <article><PackageCheck size={18} /><h4>시료·진행</h4><strong>{requestStatusLabels[request.status] ?? request.status}</strong><p>{c.sample.name || "시료명 확인 필요"} · {c.sample.quantity ?? "미확인"}개</p><small>준비일 {c.sample.readyDate || "미확인"} · {c.sample.disposal || "처리 방법 협의"}</small></article>
      <article><CalendarDays size={18} /><h4>시험 일정</h4><strong>{confirmed ? "예약 확정" : "확정 일정 없음"}</strong><p>{confirmed ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(confirmed.startAt)) : "희망일 " + (c.schedule.desiredStartDate || "미입력")}</p><small>{confirmed ? "기관이 확정한 일정" : "기관과 일정 협의 후 확정됩니다."}</small></article>
      <article><FileCheck2 size={18} /><h4>결과·성적서</h4><strong>{request.result ? "결과 등록됨" : "등록 대기"}</strong><p>{request.result?.summary || "기관이 등록한 결과가 여기에 표시됩니다."}</p>{request.result?.reportNo && <small>성적서 {request.result.reportNo}</small>}{safeReportUrl && <a href={safeReportUrl} target="_blank" rel="noopener noreferrer">등록된 성적서 보기 ↗</a>}</article>
      <article><Wallet size={18} /><h4>이용료·증빙 준비</h4><strong>{fee && Number.isFinite(fee.amount) ? `${fee.amount.toLocaleString("ko-KR")}원 (예상)` : "예상 이용료 미등록"}</strong><p>{fee?.note || "비용은 수행기관 확인이 필요합니다."}</p><small>회계 담당자 {c.accounting?.name || "미입력"} · {c.billing?.method || "청구 방법 협의"}</small><small>납부·정산 상태는 아직 제공되지 않습니다.</small></article>
    </div>
  </section>;
}
