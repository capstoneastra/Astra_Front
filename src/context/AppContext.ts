import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { User } from "../services/authService";
import type { Equipment } from "../services/equipmentService";
import type { useApiQuery } from "../hooks/useApiQuery";
import type { MatchRun, ResourceId } from "../services/contracts";
import type { SimulationPrefill } from "../domain/simulationPrefill";

type Setter<T> = Dispatch<SetStateAction<T>>;

interface WorkspaceContext {
  testCondition: string;
  setTestCondition: Setter<string>;
  selectedEquipment: Equipment | null;
  setSelectedEquipment: Setter<Equipment | null>;
  equipmentList: Equipment[];
  catalogQuery: ReturnType<typeof useApiQuery<Equipment[]>>;
  user: User;
  resolveEquipment: (id: ResourceId, signal?: AbortSignal) => Promise<Equipment | undefined>;
  requirementId: number | null;
  setRequirementId: Setter<number | null>;
  chatSessionId: number | null;
  setChatSessionId: Setter<number | null>;
  matchRun: MatchRun | null;
  setMatchRun: Setter<MatchRun | null>;
  draftRequestId: number | null;
  setDraftRequestId: Setter<number | null>;
  comparisonIds: number[];
  setComparisonIds: Setter<number[]>;
  testTypeCode: string;
  setTestTypeCode: Setter<string>;
  simulationEquipmentId: number | null;
  setSimulationEquipmentId: Setter<number | null>;
  /** 가상 시뮬레이션 [이 조건으로 의뢰서 작성] → 의뢰서가 한 번 가져가고 비움 */
  simulationPrefill: SimulationPrefill | null;
  setSimulationPrefill: Setter<SimulationPrefill | null>;
  autoRunId: number | null;
  setAutoRunId: Setter<number | null>;
  openSimulation: (id: number) => void;
  /** 시험 정보 안내 열기 — 장비에서 열면 그 장비의 시험 종류만 고를 수 있음 */
  openTestInfo: (code: string, equipment?: Pick<Equipment, "id" | "name" | "testTypes" | "institutionId">) => void;
}

export const AppContext = createContext<WorkspaceContext | null>(null);

export function useWorkspace() {
  const workspace = useContext(AppContext);
  if (!workspace) throw new Error("AppContext.Provider가 필요합니다.");
  return workspace;
}
