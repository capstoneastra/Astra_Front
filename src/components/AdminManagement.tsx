import { useState } from "react";
import { useAuth } from "../auth/context";
import { Button, FormField, PageHeader, Panel } from "./ui/index";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { adminService } from "../services/adminService";
import { DemoNotice, Feedback } from "./workflow/Feedback";
import { accountStatusLabels, roleLabels, formatDate } from "../domain/constants";
import ApiState from "./ui/ApiState";

const organizationTypeLabels = {
  COMPANY: "기업",
  INSTITUTION: "기관",
  UNIVERSITY: "대학",
};

export default function AdminManagement() {
  const { user } = useAuth(),
    [status, setStatus] = useState(""),
    [role, setRole] = useState(""),
    [page, setPage] = useState(0),
    [reasons, setReasons] = useState({}),
    action = useAction();
  const members = useApiQuery(
      (signal) => adminService.users({ page, size: 20, ...(status ? { status } : {}), ...(role ? { role } : {}) }, signal),
      `admin-users:${status}:${role}:${page}`,
    ),
    organizations = useApiQuery(
      (signal) => adminService.organizations({}, signal),
      "admin-organizations",
    );
  return (
    <div className="content-page page-enter">
      <PageHeader
        eyebrow="PLATFORM OPERATIONS"
        title="회원·기관 승인 관리"
        description="승인 대기·거절·정지 상태를 구분하고 접근 권한을 관리합니다."
      />
      <DemoNotice />
      <Panel className="form-panel">
        <div className="admin-member-filters"><FormField id="admin-status" label="계정 상태">
          <select
            id="admin-status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          >
            <option value="">전체 상태</option>
            {Object.entries(accountStatusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="admin-role" label="회원 유형"><select id="admin-role" value={role} onChange={e => { setRole(e.target.value); setPage(0); }}><option value="">전체 유형</option>{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></FormField></div>
      </Panel>
      <Feedback action={action} />
      <Panel className="form-panel" title="회원 관리">
        {members.loading || members.error ? (
          <ApiState
            loading={members.loading}
            error={members.error}
            onRetry={members.reload}
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>계정</th>
                  <th>역할·소속</th>
                  <th>상태</th>
                  <th>가입일</th>
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {members.data?.content.map((member) => (
                  <tr key={member.id}>
                    <td>
                      {member.name}
                      <small>{member.email}</small>
                    </td>
                    <td>
                      {roleLabels[member.role]}
                      <small>{member.organization?.name ?? "플랫폼"}</small>
                    </td>
                    <td>{accountStatusLabels[member.status]}</td>
                    <td>{member.createdAt ? formatDate(member.createdAt) : "미제공"}</td>
                    <td>
                      {member.status === "PENDING" ? (
                        <>
                          <Button
                            disabled={action.busy}
                            onClick={() =>
                              action.run(
                                () => adminService.approve(member.id),
                                "회원을 승인했습니다.",
                              )
                            }
                          >
                            승인
                          </Button>
                          <input
                            aria-label={`거절 사유 ${member.email}`}
                            placeholder="거절 사유"
                            value={reasons[member.id] ?? ""}
                            onChange={(e) =>
                              setReasons({
                                ...reasons,
                                [member.id]: e.target.value,
                              })
                            }
                          />
                          <Button
                            variant="danger"
                            disabled={
                              action.busy || !reasons[member.id]?.trim()
                            }
                            onClick={() =>
                              action.run(
                                () =>
                                  adminService.reject(
                                    member.id,
                                    reasons[member.id],
                                  ),
                                "가입을 거절했습니다.",
                              )
                            }
                          >
                            거절
                          </Button>
                        </>
                      ) : ["ACTIVE", "SUSPENDED"].includes(member.status) &&
                        member.id !== user.id ? (
                        <Button
                          variant="secondary"
                          disabled={action.busy}
                          onClick={() =>
                            action.run(
                              () =>
                                adminService.status(
                                  member.id,
                                  member.status === "ACTIVE"
                                    ? "SUSPENDED"
                                    : "ACTIVE",
                                ),
                              "계정 상태를 변경했습니다.",
                            )
                          }
                        >
                          {member.status === "ACTIVE"
                            ? "이용 정지"
                            : "정지 해제"}
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {members.data?.totalElements === 0 && (
          <p>해당 상태의 회원이 없습니다.</p>
        )}
        {members.data && members.data.totalPages > 1 && <div className="admin-member-pagination"><span>전체 {members.data.totalElements}명 · {page + 1}/{members.data.totalPages}페이지</span><Button variant="ghost" disabled={members.loading || page === 0} onClick={() => setPage(value => value - 1)}>이전</Button><Button variant="ghost" disabled={members.loading || page + 1 >= members.data.totalPages} onClick={() => setPage(value => value + 1)}>다음</Button></div>}
      </Panel>
      <Panel className="form-panel" title="기관 승인 현황">
        {organizations.loading || organizations.error ? (
          <ApiState
            loading={organizations.loading}
            error={organizations.error}
            onRetry={organizations.reload}
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>기관·기업</th>
                  <th>유형</th>
                  <th>승인 상태</th>
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {organizations.data?.content.map((org) => (
                  <tr key={org.id}>
                    <td>{org.name}</td>
                    <td>{organizationTypeLabels[org.orgType] ?? org.orgType}</td>
                    <td>{org.isVerified ? "승인" : "확인 필요"}</td>
                    <td>
                      {["INSTITUTION", "UNIVERSITY"].includes(org.orgType) && !org.isVerified ? (
                        <Button
                          disabled={action.busy}
                          onClick={() =>
                            action.run(
                              () => adminService.verify(org.id),
                              "기관을 승인했습니다.",
                            )
                          }
                        >
                          기관 승인
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
