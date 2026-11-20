import { useState } from "react";
import { Building2, ClipboardList, Info, CalendarDays } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { Badge, Button, EmptyState, PageHeader, Panel } from "./ui";
import { useApiQuery } from "../hooks/useApiQuery";
import { requestService } from "../services/requestService";
import RequestDetailDialog from "./workflow/RequestDetailDialog";
import ApiState from "./ui/ApiState";
import { requestStatusLabels, formatDate } from "../domain/constants";
import { apiConfig } from "../api/config";

export default function ReservationCheck({
  setActiveMenu,
  institutionView = false,
}) {
  const { user, setDraftRequestId, setSelectedEquipment, equipmentList } =
    useWorkspace();
  const [selected, setSelected] = useState(null),
    [status, setStatus] = useState("");
  const query = useApiQuery(
    (signal) => requestService.list(status ? { status } : {}, signal),
    `requests:${user.id}:${status}`,
  );
  const reservations = query.data?.content ?? [],
    company = ["COMPANY_USER", "ADMIN"].includes(user.role);

  return (
    <div className="content-page page-enter">
      <PageHeader
        eyebrow="MY TEST REQUESTS"
        title={
          institutionView
            ? "기관 검토·정보 보완"
            : user.role === "INSTITUTION_MANAGER"
              ? "기관 접수 의뢰"
              : "내 의뢰 관리"
        }
        description="신청한 시험 의뢰를 확인하고 관리하세요."
      >
        <Button variant="secondary" icon={CalendarDays} onClick={() => setActiveMenu("calendar")}>예약 캘린더</Button>
        <Badge tone="cyan">
          {query.loading ? "조회 중" : (query.data?.totalElements ?? "—")}건
        </Badge>
      </PageHeader>
      <div className="content-note">
        <Info size={16} />
        <span>
          {apiConfig.isMock
            ? "DEMO · 이 브라우저의 시연 의뢰입니다. 계정을 바꿔도 진행 상태가 유지됩니다."
            : "소속 기업·기관의 의뢰만 조회합니다."}{" "}
          제출·검토·보완·예약은 각각 별도 상태로 관리합니다.
        </span>
      </div>
      <Panel className="search-toolbar">
        <label htmlFor="requests-status">진행 상태</label>
        <select
          id="requests-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">전체 상태</option>
          {Object.entries(requestStatusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Panel>
      {query.loading || query.error ? (
        <Panel>
          <ApiState
            loading={query.loading}
            error={query.error}
            onRetry={query.reload}
          />
        </Panel>
      ) : reservations.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ClipboardList}
            title="아직 신청한 시험 의뢰가 없습니다"
            description="장비 검색에서 시험장비를 선택하고 첫 번째 의뢰를 시작해 보세요."
          />
        </Panel>
      ) : (
        <div className="request-list">
          {reservations.map((item) => (
            <Panel className="request-card" key={item.id}>
              <div className="request-card__header">
                <span className="request-card__number">
                  REQUEST / {item.id}
                </span>
                <div>
                  <Badge tone="amber" dot>
                    {requestStatusLabels[item.status] ?? item.status}
                  </Badge>
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(item.id)}
                  >
                    의뢰 상세
                  </Button>
                </div>
              </div>
              <h2>{item.equipment?.name}</h2>
              <p className="request-card__institution">
                <Building2 size={14} />
                {item.institution?.name || "보유기관 미입력"}
              </p>
              <div className="request-card__dates">
                <div>
                  <span>신청일</span>
                  {formatDate(item.createdAt)}
                </div>
                <div>
                  <span>희망 시험일</span>
                  <strong>
                    {item.revision.content.schedule.desiredStartDate ||
                      "기관 협의"}
                  </strong>
                </div>
              </div>
              <div className="request-card__condition">
                <span>요청 시험조건</span>
                <p>{item.revision.content.test.purpose || "확인 필요"}</p>
                <p>
                  제출본 {item.revision.revisionNo} · {item.requestNo}
                </p>
                {company && item.status === "DRAFT" && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDraftRequestId(item.id);
                      setSelectedEquipment(
                        equipmentList.find((e) => e.id === item.equipment.id) ??
                          null,
                      );
                      setActiveMenu("reservation");
                    }}
                  >
                    초안 이어서 작성
                  </Button>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
      {selected && (
        <RequestDetailDialog
          key={selected}
          requestId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
