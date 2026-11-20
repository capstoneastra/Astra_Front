import { Building2, Search } from "lucide-react";
import { Badge, EmptyState, Panel } from "../ui";
import ApiState from "../ui/ApiState";
import type { ApiStateProps } from "../ui/ApiState";
import type { Equipment } from "../../services/equipmentService";

export default function InstitutionNetwork({ equipmentList, onSearch, loading, error, onRetry }: ApiStateProps & {
  equipmentList: Equipment[];
  onSearch: (query: string, options: { institutionId: number | null }) => void;
}) {
  const institutions = [...new Map(equipmentList.filter((item) => item.institution).map((item) => [item.institutionId ?? item.institution, {
    id: item.institutionId, name: item.institution,
    count: equipmentList.filter((other) => other.institution === item.institution).length,
  }])).values()];
  return <Panel className="institution-directory" title="장비 보유기관" action={<Badge tone="cyan">{institutions.length}개 기관</Badge>}>
    {loading || error ? <ApiState loading={loading} error={error} onRetry={onRetry} /> : institutions.length ?
      <div className="institution-directory__list">{institutions.map((institution) => <button type="button" key={institution.id ?? institution.name}
        onClick={() => onSearch(institution.name, { institutionId: institution.id })}>
        <span className="institution-icon"><Building2 size={18} /></span>
        <span><strong>{institution.name}</strong><small>등록 장비 {institution.count}대</small></span>
        <Search size={16} aria-hidden="true" />
      </button>)}</div> : <EmptyState title="등록된 보유기관이 없습니다" description="장비의 보유기관 정보가 등록되면 표시됩니다." />}
  </Panel>;
}
