import type { EquipmentSpec } from "../services/contracts";

const has = (v: number | null | undefined): v is number => v !== null && v !== undefined;

/** 장비 사양 한 줄 — 값 · 범위 · 이상/이하 · 글 순서로 (장비 상세, 시험 정보 안내가 같이 씀) */
export function specValue(spec: EquipmentSpec) {
  const unit = spec.unit ?? "";
  if (has(spec.value)) return `${spec.value} ${unit}`.trim();
  if (has(spec.min) && has(spec.max)) return `${spec.min} ~ ${spec.max} ${unit}`.trim();
  if (has(spec.min)) return `${spec.min} ${unit} 이상`.replace(/\s+/g, " ");
  if (has(spec.max)) return `${spec.max} ${unit} 이하`.replace(/\s+/g, " ");
  return spec.valueText || "확인 필요";
}
