export type ResourceId = number | string;

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface NamedResource {
  id: number;
  name: string;
}

export interface EquipmentSpec {
  key: string;
  label?: string | null;
  unit?: string | null;
  value?: number | null;
  min?: number | null;
  max?: number | null;
  valueText?: string | null;
  sourceType: string;
  verificationStatus?: string | null;
  usageScope?: string | null;
}

export interface EquipmentDto {
  id: number;
  name: string;
  testTypes: string[];
  isMock: boolean;
  institution?: NamedResource | null;
  model?: string | null;
  externalId?: string | null;
  description?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  region?: string | null;
  equipmentType?: string | null;
  availability?: string | null;
  isActive?: boolean;
  infoUpdatedAt?: string | null;
  verificationStatus?: string | null;
  utilizationRate?: number | null;
  feeText?: string | null;
  specs?: EquipmentSpec[];
  usage?: {
    feeText?: string | null;
    feeAmount?: number | null;
    feeUnit?: string | null;
    durationText?: string | null;
    accessScope?: string | null;
    availability?: string | null;
    utilizationRate?: number | null;
  } | null;
  source?: { type?: string; url?: string; file?: string; page?: number } | null;
  simulation?: { capability?: string; presetIds?: number[] } | null;
}

export interface TimeInterval {
  startAt: string;
  endAt: string;
}

export interface ReservationRecord extends TimeInterval {
  id: number;
  status: string;
  version: number;
  note?: string | null;
  createdAt?: string;
}

export type RequestBox = "SENT" | "RECEIVED";

export interface RequestSummary {
  id: number;
  requestNo: string;
  status: string;
  title: string;
  equipment?: (NamedResource & { externalId?: string }) | null;
  institution?: NamedResource | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  revision: RequestRevision;
}

export interface RequestRevision {
  revisionNo: number;
  isAiGenerated?: boolean;
  changeSummary?: string | null;
  content: RequestContent;
}

export interface RequestContent {
  applicant: { companyName?: string; contactName?: string; email?: string; phone?: string };
  test: { testTypeCode?: string; purpose?: string; conditions?: RequirementCondition[] };
  schedule: { desiredStartDate?: string | null; desiredEndDate?: string | null };
  sample: { name?: string; quantity?: number | null; size?: string; weight?: string; notes?: string; readyDate?: string | null };
  conditions: RequirementCondition[];
}

export interface RequestDetail extends RequestSummary {
  reservations: ReservationRecord[];
  version: number;
  supplements: {
    id: number;
    status: string;
    message: string;
    dueDate?: string | null;
    items: { fieldKey: string; label?: string; message?: string; required?: boolean }[];
  }[];
}

export interface TestType {
  code: string;
  nameKo: string;
  description?: string | null;
  equipmentCount?: number;
}

export interface ConditionRule {
  conditionKey: string;
  label: string;
  unit?: string | null;
  valueType: string;
  comparator: string;
  isRequired: boolean;
}

export interface TestTypeDetail extends TestType {
  conditionRules: ConditionRule[];
  institutions: (NamedResource & {
    region?: string | null;
    equipmentCount: number;
    estCostMin?: number | null;
    estDurationDays?: number | null;
    accessScope?: string | null;
  })[];
}

export interface MatchRun {
  requirementId: number;
  disclaimer: string;
  results: {
    id: number;
    rank: number;
    equipment: NamedResource & { externalId?: string; institutionName?: string };
    verdict: string;
    reason: string;
    score: number;
    usedMockData: boolean;
    checks: {
      conditionKey: string;
      result: string;
      requiredText?: string;
      equipmentText?: string;
      sourceType?: string;
      note?: string;
    }[];
  }[];
}

export interface RequirementCondition {
  key: string;
  label?: string;
  unit?: string | null;
  status?: string;
  source?: string;
  confidence?: number | null;
  note?: string | null;
  value?: number;
  min?: number;
  max?: number;
  valueText?: string;
}

export interface Requirement {
  id: number;
  testTypeCode: string;
  title: string;
  purpose: string;
  sampleName: string;
  sampleQuantity: number | null;
  conditions: RequirementCondition[];
}
