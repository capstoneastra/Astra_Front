// Original prototype catalog, explicitly isolated from production API data.
// DEV + VITE_DATA_SOURCE=mock only. This does not bypass real authentication.
import type { EquipmentDto } from "../services/contracts";

const institution = { id: 1, name: "한국생산기술연구원 진주뿌리기술지원센터" };
export const mockEquipment: EquipmentDto[] = [
  {
    id: 1,
    externalId: "DEMO-0001",
    name: "치구복합가공기 (INTEGREX e-670H-40000)",
    testTypes: ["기계가공"],
    description: "초정밀 가공 및 복합 형상 가공",
  },
  {
    id: 2,
    externalId: "DEMO-0002",
    name: "10,000톤 형단조 프레스",
    testTypes: ["소성가공"],
    description: "대형 항공기 부품 단조 성형",
  },
  {
    id: 3,
    externalId: "DEMO-0003",
    name: "3차원 비접촉식 측정기 (ZS-4060)",
    testTypes: ["검사/시험"],
    description: "역설계 및 3차원 정밀 측정",
  },
].map((item) => ({
  ...item,
  institution,
  isMock: true,
  infoUpdatedAt: "2026-10-26",
  specs: [],
  usage: { availability: "UNKNOWN", durationText: null, feeText: null },
}));
