export const requestStatusLabels = {
  DRAFT: "작성 중",
  SUBMITTED: "접수",
  UNDER_REVIEW: "검토 중",
  SUPPLEMENT_REQUESTED: "보완 요청",
  RESUBMITTED: "재제출",
  SCHEDULING: "일정 협의",
  CONFIRMED: "예약 확정",
  COMPLETED: "시험 완료",
  REJECTED: "반려",
  CANCELED: "취소",
};
/** 의뢰 상태 배지 색 (시험 의뢰 관리 목록·상세 이력이 같이 씀) */
export const requestStatusTones: Record<string, string> = {
  DRAFT: "neutral", SUBMITTED: "cyan", UNDER_REVIEW: "cyan", RESUBMITTED: "cyan", SUPPLEMENT_REQUESTED: "amber",
  SCHEDULING: "violet", CONFIRMED: "green", COMPLETED: "neutral", REJECTED: "neutral", CANCELED: "neutral",
};
export const checkLabels = {
  MET: "충족",
  NOT_MET: "불일치",
  UNKNOWN: "미확인",
};
export const verdictLabels = {
  SUITABLE: "조건 충족",
  PARTIAL: "일부 확인 필요",
  UNSUITABLE: "조건 불일치",
  UNKNOWN: "미확인",
};
export const roleLabels = {
  COMPANY_USER: "기업 회원",
  INSTITUTION_MANAGER: "기관 담당자",
  ADMIN: "관리자",
};
export const accountStatusLabels = {
  ACTIVE: "활성",
  PENDING: "승인 대기",
  REJECTED: "가입 거절",
  SUSPENDED: "이용 정지",
};
export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    : "확인 필요";
export function valueText(value) {
  if (!value) return "확인 필요";
  return `${value.value ?? (value.min != null && value.max != null ? `${value.min}~${value.max}` : (value.valueText ?? "확인 필요"))} ${value.unit ?? ""}`.trim();
}
