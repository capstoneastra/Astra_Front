import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 헤더 왼쪽(빠른 검색 왼쪽) 자리에 화면별 전환 버튼을 꽂는 슬롯.
 * 예) 대시보드 '장비 운영 / 내 의뢰', 의뢰 관리·캘린더 '받은 의뢰 / 보낸 의뢰'
 */
export const HEADER_SLOT_ID = "app-header-slot";

export function HeaderSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(document.getElementById(HEADER_SLOT_ID)); }, []);
  return target ? createPortal(children, target) : null;
}

/** 두 가지 중 하나를 고르는 전환 버튼 — 선택 받침이 미끄러지듯 이동 */
export function ViewSwitch<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: [{ value: T; label: string; title?: string }, { value: T; label: string; title?: string }];
  onChange: (value: T) => void;
}) {
  return (
    <div className="view-switch" role="tablist" aria-label={label} data-active={value === options[1].value ? "1" : "0"}>
      <i className="view-switch__thumb" aria-hidden="true" />
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={value === option.value} title={option.title}
          onClick={() => { if (value !== option.value) onChange(option.value); }}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
