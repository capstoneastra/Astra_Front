import type { Equipment } from "../services/equipmentService";
export const chartColors = ["#38bdf8", "#818cf8", "#fbbf24", "#c084fc", "#2dd4bf", "#94a3b8", "#fb7185"];
export function requestDistribution(counts: Record<string, number>) {
  return [
    { label: "작성 중", keys: ["DRAFT"] },
    { label: "접수·검토", keys: ["SUBMITTED", "UNDER_REVIEW", "RESUBMITTED"] },
    { label: "보완 요청", keys: ["SUPPLEMENT_REQUESTED"] },
    { label: "일정 협의", keys: ["SCHEDULING"] },
    { label: "예약 확정", keys: ["CONFIRMED"] },
    { label: "시험 완료", keys: ["COMPLETED"] },
    { label: "반려·취소", keys: ["REJECTED", "CANCELED"] },
  ].map(({ label, keys }, index) => ({ label, value: keys.reduce((sum, key) => sum + (counts[key] ?? 0), 0), color: chartColors[index] }));
}
export function equipmentDistribution(items: Equipment[]) {
  const states = ["AVAILABLE", "BUSY", "MAINTENANCE", "UNAVAILABLE", "UNKNOWN"];
  const labels = ["가용", "사용 중", "정비 중", "제공 중단", "미확인"];
  return states.map((state, index) => ({ label: labels[index], color: chartColors[index], value: items.filter(item => (states.includes(item.availability) ? item.availability : "UNKNOWN") === state).length }));
}
