import { Info } from "lucide-react";
import type { RefObject } from "react";

const steps = [
  ["시험조건 정리", "시험항목과 시료의 질량·크기, 시험 범위 등 필요한 조건을 정리합니다."],
  ["장비 검색·사양 비교", "조건에 맞는 장비를 검색하고 사양과 예상 비용·소요 기간을 비교합니다."],
  ["시험 의뢰", "선택한 장비의 기관에 시험조건과 관련 자료를 담은 의뢰서를 제출합니다."],
  ["기관 검토·일정 협의", "기관의 기술 검토와 보완 요청에 대응하고, 시험 가능 여부와 일정을 협의합니다."],
];

interface LoginGuideProps {
  open: boolean;
  headingRef: RefObject<HTMLHeadingElement>;
}

export default function LoginGuide({ open, headingRef }: LoginGuideProps) {
  return (
    <section
      id="login-guide"
      className="login-screen login-guide"
      aria-hidden={!open}
      aria-labelledby="login-guide-heading"
      ref={(element) => { if (element) element.inert = !open; }}
    >
      <div className="login-guide__layout">
        <div className="login-guide__intro">
          <h1 id="login-guide-heading" ref={headingRef} tabIndex={-1}>이용 안내</h1>
          <p>시험조건 확인부터 기관 검토까지, 다음 순서로 진행됩니다.</p>
        </div>
        <div className="login-guide__panel">
          <ol className="login-guide__steps">
            {steps.map(([title, description], index) => (
              <li key={title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="login-guide__notice">
            <Info size={16} aria-hidden="true" />
            시험 가능 여부와 비용·일정은 기관 검토 후 확정됩니다.
          </p>
        </div>
      </div>
    </section>
  );
}
