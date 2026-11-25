import { Check } from "lucide-react";
const steps = ["장비·상담 선택", "의뢰 내용 보완", "최종 확인", "제출·접수"];
export default function RequestSteps({ current }: { current: number }) {
  return <aside className="request-steps" aria-label="시험 의뢰 작성 진척도"><span>의뢰 작성 <b>{current + 1} / {steps.length}</b></span><ol>{steps.map((title, index) => <li key={title} aria-current={index === current ? "step" : undefined} data-complete={index < current}><i>{index < current ? <Check size={12} /> : index + 1}</i><span>{title}</span></li>)}</ol><small>제출 후 검토 → 일정 협의 → 예약 확정 → 시험·성적서</small></aside>;
}
