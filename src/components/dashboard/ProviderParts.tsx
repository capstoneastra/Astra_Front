import type { Equipment } from "../../services/equipmentService";

const DAY = 86_400_000;

/** 갱신이 필요한 장비인지와 그 이유 — 대시보드 첫 칸 숫자와 보유 장비 관리 표에서 함께 씁니다. */
export function needsUpdate(item: Equipment, now: number) {
  const age = item.updateDate ? Math.floor((now - Date.parse(`${item.updateDate}T00:00:00+09:00`)) / DAY) : null;
  const reasons: string[] = [];
  if (item.verificationStatus !== "CONFIRMED") reasons.push("사양 정보 미확인");
  if (age == null) reasons.push("갱신일 없음");
  else if (age > 180) reasons.push(`${Math.floor(age / 30)}개월 전 갱신`);
  if (item.isMock) reasons.push("미검증 사양 포함");
  return { reasons, age };
}
