import { Badge } from "../ui";
import { useState } from "react";
import type { Equipment } from "../../services/equipmentService";
const labels = { AVAILABLE: "가용", BUSY: "사용 중", MAINTENANCE: "정비 중", UNAVAILABLE: "제공 중단", UNKNOWN: "가용 상태 미확인" };
export default function EquipmentStatus({ equipment: e, showTestType = true }: { equipment: Equipment; showTestType?: boolean }) {
  const verified = e.verificationStatus === "INSTITUTION_VERIFIED";
  const [now] = useState(Date.now);
  const outdated = !e.infoUpdatedAt || now - Date.parse(e.infoUpdatedAt) > 90 * 86400000;
  const availabilityNeedsConfirmation = e.raw.availabilityNeedsConfirmation ?? (!e.availability || e.availability === "UNKNOWN" || !e.raw.availabilityUpdatedAt);
  const needsUpdate = e.raw.needsUpdate ?? (availabilityNeedsConfirmation || !verified || outdated);
  return <div className="equipment-status"><Badge tone={e.availability === "AVAILABLE" ? "cyan" : "neutral"}>{labels[e.availability ?? "UNKNOWN"] ?? "가용 상태 미확인"}</Badge><Badge tone={verified ? "cyan" : "amber"}>{verified ? "보유 조직 확인됨" : "보유 조직 확인 전"}</Badge>{needsUpdate && <Badge tone="amber">갱신 필요</Badge>}<small>{showTestType && <>{e.testItem || "시험유형 미등록"} · </>}갱신 {e.updateDate ?? "미확인"}</small></div>;
}
