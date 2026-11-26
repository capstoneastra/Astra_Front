import { useEffect, useState } from "react";
import { Building2, Check, Pencil, Plus, Search, Users, X } from "lucide-react";
import { useAuth } from "../auth/context";
import { useWorkspace } from "../context/AppContext";
import { Badge, Button, EmptyState, FormField, PageHeader, Panel } from "./ui/index";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { adminService } from "../services/adminService";
import type { Organization, OrganizationInput } from "../services/adminService";
import { Feedback } from "./workflow/Feedback";
import { accountStatusLabels, roleLabels } from "../domain/constants";
import ApiState from "./ui/ApiState";
import type { ApprovalFocus } from "../hooks/useWorkspaceNavigation";

const organizationTypeLabels: Record<string, string> = { COMPANY: "기업", INSTITUTION: "기관", UNIVERSITY: "대학" };
const statusTone: Record<string, string> = { ACTIVE: "green", PENDING: "amber", REJECTED: "neutral", SUSPENDED: "violet" };
const rejectReasons = ["소속 확인 불가", "중복 가입", "필수 정보 누락", "허위 정보"];
/** 가입일: 2026.11.24 */
const shortDate = (value?: string | null) => value
  ? new Date(Date.parse(value) + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, ".") : "—";
/** 최근 로그인: 방금, 3시간 전, 5일 전 (30일 넘으면 날짜) */
const agoText = (value: string | null | undefined, now: number) => {
  if (!value) return "기록 없음";
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000));
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  const days = Math.floor(minutes / 1440);
  return days <= 30 ? `${days}일 전` : shortDate(value);
};
/** 관리자 회원 목록 응답에는 화면 User 타입에 없는 날짜 필드가 더 있다 */
type MemberDates = { createdAt?: string | null; lastLoginAt?: string | null };
type Tab = "pending" | "members" | "organizations";

/**
 * 회원·기관 승인.
 * 관리자가 가장 자주 하는 일(가입 승인)을 첫 탭에 두고, 한 화면에서 선택 승인·사유 선택 거절이 되도록 정리했습니다.
 */
/** 기관·대학 등록/수정 폼 — API 명세의 POST·PATCH /admin/organizations 에 대응합니다. */
function OrganizationForm({ target, busy, onCancel, onSubmit }: {
  target: Organization | "new";
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: OrganizationInput) => void;
}) {
  const creating = target === "new";
  const base = creating ? null : target;
  const [form, setForm] = useState<OrganizationInput>({
    orgType: "INSTITUTION", name: base?.name ?? "", region: base?.region ?? "", phone: base?.phone ?? "",
    address: base?.address ?? "", homepageUrl: base?.homepageUrl ?? "",
  });
  const set = (key: keyof OrganizationInput) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });
  const submit = () => {
    const changed = Object.fromEntries(Object.entries(form).filter(([key, value]) =>
      creating ? Boolean(value) : key !== "orgType" && value !== ((base as unknown as Record<string, unknown>)[key] ?? "")));
    onSubmit(changed);
  };
  return (
    <Panel className="admin-panel admin-org-form" title={creating ? "기관·대학 직접 등록" : `${base.name} 정보 수정`}
      description={creating ? "직접 등록한 기관은 바로 승인 상태가 됩니다." : "변경한 항목만 저장됩니다."}
      action={<button type="button" className="icon-button" aria-label="닫기" onClick={onCancel}><X size={16} /></button>}>
      <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="form-grid">
          {creating && (
            <FormField id="org-type" label="유형 *">
              <select id="org-type" value={form.orgType} onChange={set("orgType")}>
                <option value="INSTITUTION">기관</option>
                <option value="UNIVERSITY">대학</option>
              </select>
            </FormField>
          )}
          <FormField id="org-name" label="이름 *"><input id="org-name" required value={form.name} onChange={set("name")} /></FormField>
          <FormField id="org-region" label="지역"><input id="org-region" value={form.region} onChange={set("region")} placeholder="예: 경남 진주" /></FormField>
          <FormField id="org-phone" label="대표 연락처"><input id="org-phone" type="tel" value={form.phone} onChange={set("phone")} /></FormField>
          <FormField id="org-address" label="주소"><input id="org-address" value={form.address} onChange={set("address")} /></FormField>
          <FormField id="org-homepage" label="홈페이지"><input id="org-homepage" type="url" value={form.homepageUrl} onChange={set("homepageUrl")} placeholder="https://" /></FormField>
        </div>
        <div className="admin-org-form__actions">
          <Button variant="ghost" onClick={onCancel}>취소</Button>
          <Button type="submit" icon={Check} disabled={busy || !form.name?.trim()}>{creating ? "등록" : "저장"}</Button>
        </div>
      </form>
    </Panel>
  );
}

export default function AdminManagement({ approvalFocus, initialKeyword = "" }: { approvalFocus?: ApprovalFocus; initialKeyword?: string }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState(initialKeyword);
  const [orgEditing, setOrgEditing] = useState<Organization | "new" | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const action = useAction();

  const pending = useApiQuery((signal) => adminService.users({ status: "PENDING" }, signal), "admin-users:PENDING");
  const members = useApiQuery((signal) => adminService.users(status ? { status } : {}, signal), `admin-users:${status}`, tab === "members");
  const organizations = useApiQuery((signal) => adminService.organizations({}, signal), "admin-organizations:all", tab === "organizations" || tab === "pending");
  const pendingOrgs = (organizations.data?.content ?? []).filter((org) => org.orgType !== "COMPANY" && !org.isVerified);
  const pendingUsers = pending.data?.content ?? [];
  // 기관 목록의 '회원'·'장비' 칸: 전체 회원 목록(전체 회원 탭과 같은 캐시)·장비 목록으로 센다
  const { equipmentList } = useWorkspace();
  const allUsers = useApiQuery((signal) => adminService.users({}, signal), "admin-users:", tab === "organizations");
  const memberCount = new Map<number, number>();
  for (const m of allUsers.data?.content ?? []) if (m.organization?.id) memberCount.set(m.organization.id, (memberCount.get(m.organization.id) ?? 0) + 1);
  const equipmentCount = new Map<number, number>();
  for (const e of equipmentList) if (e.institutionId) equipmentCount.set(e.institutionId, (equipmentCount.get(e.institutionId) ?? 0) + 1);
  const [now] = useState(() => Date.now());

  useEffect(() => { setSelected([]); setOrgEditing(null); }, [tab]);
  useEffect(() => {
    if (approvalFocus !== "organizations") return;
    const timer = window.setTimeout(() => document.getElementById("organization-approvals")?.scrollIntoView({ block: "start", behavior: "smooth" }), 400);
    return () => window.clearTimeout(timer);
  }, [approvalFocus]);

  const term = keyword.trim().toLowerCase();
  const matches = (text: string) => !term || text.toLowerCase().includes(term);
  const memberRows = (tab === "pending" ? pendingUsers : members.data?.content ?? [])
    .filter((m) => matches(`${m.name} ${m.email} ${m.organization?.name ?? ""}`));
  const orgRows = (organizations.data?.content ?? []).filter((org) => matches(org.name));

  const approveSelected = () => action.run(async () => {
    for (const id of selected) await adminService.approve(id);
    setSelected([]);
  }, `${selected.length}명을 승인했습니다.`);

  const tabs: { id: Tab; label: string; count?: number; icon: typeof Users }[] = [
    { id: "pending", label: "승인 대기", count: pendingUsers.length + pendingOrgs.length, icon: Check },
    { id: "members", label: "전체 회원", icon: Users },
    { id: "organizations", label: "기관·기업", icon: Building2 },
  ];

  const memberTable = (rows: typeof memberRows, withSelect: boolean) => (
    <div className="table-scroll">
      <table className={`admin-table admin-table--members${withSelect ? " has-check" : ""}`}>
        <thead>
          <tr>
            {withSelect && <th className="admin-table__check">
              <input type="checkbox" aria-label="전체 선택" checked={rows.length > 0 && selected.length === rows.length}
                onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} />
            </th>}
            <th>신청자</th><th>역할·소속</th><th className="admin-table__fit">연락처</th><th className="admin-table__fit">가입일</th>
            <th className="admin-table__fit">최근 로그인</th><th className="admin-table__fit">상태</th><th className="admin-table__actions">처리</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => (
            <tr key={member.id} className={selected.includes(member.id) ? "is-selected" : undefined}>
              {withSelect && <td className="admin-table__check">
                <input type="checkbox" aria-label={`${member.name} 선택`} checked={selected.includes(member.id)}
                  onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, member.id] : ids.filter((x) => x !== member.id))} />
              </td>}
              <td title={`${member.name}, ${member.email}`}><strong>{member.name}</strong><small>{member.email}</small></td>
              <td title={member.organization?.name ?? undefined}>{member.organization?.orgType === "UNIVERSITY" ? "대학 담당자" : roleLabels[member.role]}<small>{member.organization?.name ?? "소속 없음"}</small></td>
              <td className="admin-table__fit admin-table__num">{member.phone || <span className="admin-muted">—</span>}</td>
              <td className="admin-table__fit admin-table__num">{shortDate((member as MemberDates).createdAt)}</td>
              <td className="admin-table__fit admin-table__num">{member.status === "PENDING" ? <span className="admin-muted">승인 전</span> : agoText((member as MemberDates).lastLoginAt, now)}</td>
              <td className="admin-table__fit"><Badge tone={statusTone[member.status]}>{accountStatusLabels[member.status] ?? member.status}</Badge></td>
              <td className="admin-table__actions">
                {member.status === "PENDING" ? (
                  rejecting === member.id ? (
                    <span className="admin-reasons" role="group" aria-label="거절 사유">
                      {rejectReasons.map((reason) => (
                        <button key={reason} type="button" disabled={action.busy}
                          onClick={() => action.run(() => adminService.reject(member.id, reason), "가입을 거절했습니다.").then(() => setRejecting(null))}>{reason}</button>
                      ))}
                      <button type="button" className="admin-reasons__cancel" onClick={() => setRejecting(null)}>취소</button>
                    </span>
                  ) : (
                    // 승인(왼쪽)·거절(오른쪽) 모두 같은 크기의 테두리 버튼. 거절은 빨간 글자로만 구분
                    <span className="admin-actions">
                      <Button variant="secondary" icon={Check} className="admin-btn admin-btn--approve" disabled={action.busy}
                        onClick={() => action.run(() => adminService.approve(member.id), `${member.name}님을 승인했습니다.`)}>승인</Button>
                      <Button variant="secondary" icon={X} className="admin-btn admin-btn--reject" disabled={action.busy}
                        onClick={() => setRejecting(member.id)}>거절</Button>
                    </span>
                  )
                ) : ["ACTIVE", "SUSPENDED"].includes(member.status) && member.id !== user.id ? (
                  <Button variant="secondary" className={`admin-btn${member.status === "ACTIVE" ? " admin-btn--danger" : ""}`} disabled={action.busy}
                    onClick={() => action.run(() => adminService.status(member.id, member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"), "계정 상태를 변경했습니다.")}>
                    {member.status === "ACTIVE" ? "이용 정지" : "정지 해제"}
                  </Button>
                ) : <span className="admin-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const orgTable = (rows: typeof orgRows) => (
    <div className="table-scroll">
      <table className="admin-table admin-table--orgs">
        <thead><tr><th>조직</th><th className="admin-table__fit">유형</th><th className="admin-table__fit">지역</th><th>연락처</th>
          <th className="admin-table__fit admin-table__count">회원</th><th className="admin-table__fit admin-table__count">장비</th><th className="admin-table__fit">등록일</th>
          <th className="admin-table__fit">상태</th><th className="admin-table__actions">처리</th></tr></thead>
        <tbody>
          {rows.map((org) => (
            <tr key={org.id}>
              <td title={[org.name, org.address].filter(Boolean).join(", ")}><strong>{org.name}</strong>{(org.address || org.homepageUrl) && <small>{org.address || org.homepageUrl}</small>}</td>
              <td className="admin-table__fit">{organizationTypeLabels[org.orgType] ?? org.orgType}</td>
              <td className="admin-table__fit">{org.region || <span className="admin-muted">—</span>}</td>
              <td>{org.phone || org.email ? <>{org.phone}{org.email && <small>{org.email}</small>}</> : <span className="admin-muted">—</span>}</td>
              <td className="admin-table__fit admin-table__count">{allUsers.data ? memberCount.get(org.id) ?? 0 : "–"}</td>
              <td className="admin-table__fit admin-table__count">{org.orgType === "COMPANY" ? <span className="admin-muted">—</span> : equipmentCount.get(org.id) ?? 0}</td>
              <td className="admin-table__fit admin-table__num">{shortDate(org.createdAt)}</td>
              <td className="admin-table__fit"><Badge tone={org.isVerified ? "green" : "amber"}>{org.isVerified ? "승인" : "확인 필요"}</Badge></td>
              <td className="admin-table__actions">
                {org.orgType !== "COMPANY" && !org.isVerified ? (
                  <Button variant="secondary" icon={Check} className="admin-btn" disabled={action.busy}
                    onClick={() => action.run(() => adminService.verify(org.id), `${org.name}을(를) 승인했습니다.`)}>기관 승인</Button>
                ) : (
                  <Button variant="secondary" icon={Pencil} className="admin-btn" disabled={action.busy} onClick={() => setOrgEditing(org)}>수정</Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const saveOrganization = (body: OrganizationInput) => {
    if (!orgEditing) return;
    const creating = orgEditing === "new";
    if (!creating && !Object.keys(body).length) { setOrgEditing(null); return; }
    void action.run(async () => {
      if (creating) await adminService.createOrganization(body);
      else await adminService.updateOrganization(orgEditing.id, body);
      return true;
    }, creating ? `${body.name}을(를) 등록했습니다.` : "기관 정보를 수정했습니다.")
      .then((saved) => { if (saved) setOrgEditing(null); });
  };

  return (
    <div className="content-page page-enter admin-page">
      <PageHeader title="회원·기관 승인" description="가입 신청을 확인하고 계정 상태를 관리합니다." />

      <div className="admin-toolbar">
        <div className="admin-tabs" role="tablist" aria-label="관리 항목">
          {tabs.map(({ id, label, count, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              <Icon size={15} aria-hidden="true" />{label}
              {count != null && count > 0 && <span className="admin-tabs__count">{count}</span>}
            </button>
          ))}
        </div>
        <div className="admin-filters">
          {tab === "members" && (
            <select aria-label="계정 상태" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">전체 상태</option>
              {Object.entries(accountStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          )}
          <label className="admin-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">이름·이메일·소속 검색</span>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="이름·이메일·소속 검색" />
          </label>
        </div>
      </div>

      <Feedback action={action} />

      {tab === "pending" && <>
        <Panel className="admin-panel" title={<>회원 가입 신청 <span className="dash-section__count">{pendingUsers.length}</span></>}
          action={selected.length > 0 && <Button icon={Check} disabled={action.busy} onClick={approveSelected}>선택한 {selected.length}명 승인</Button>}>
          {pending.loading || pending.error ? <ApiState loading={pending.loading} error={pending.error} onRetry={pending.reload} />
            : memberRows.length ? memberTable(memberRows, true) : <EmptyState icon={Check} title="처리할 가입 신청이 없습니다" />}
        </Panel>
        <Panel id="organization-approvals" tabIndex={-1} className="admin-panel" title={<>기관·대학 등록 신청 <span className="dash-section__count">{pendingOrgs.length}</span></>}>
          {organizations.loading || organizations.error ? <ApiState loading={organizations.loading} error={organizations.error} onRetry={organizations.reload} />
            : pendingOrgs.length ? orgTable(pendingOrgs.filter((org) => matches(org.name))) : <EmptyState icon={Building2} title="승인할 기관·대학이 없습니다" />}
        </Panel>
      </>}

      {tab === "members" && (
        <Panel className="admin-panel">
          {members.loading || members.error ? <ApiState loading={members.loading} error={members.error} onRetry={members.reload} />
            : memberRows.length ? memberTable(memberRows, false) : <EmptyState icon={Users} title="조건에 맞는 회원이 없습니다" />}
        </Panel>
      )}

      {tab === "organizations" && orgEditing && (
        <OrganizationForm key={orgEditing === "new" ? "new" : orgEditing.id} target={orgEditing} busy={action.busy}
          onCancel={() => setOrgEditing(null)} onSubmit={saveOrganization} />
      )}
      {tab === "organizations" && (
        <Panel className="admin-panel" title="등록된 기관·기업"
          action={<Button icon={Plus} variant="secondary" onClick={() => setOrgEditing("new")}>기관·대학 등록</Button>}>
          {organizations.loading || organizations.error ? <ApiState loading={organizations.loading} error={organizations.error} onRetry={organizations.reload} />
            : orgRows.length ? orgTable(orgRows) : <EmptyState icon={Building2} title="조회된 조직이 없습니다" />}
        </Panel>
      )}
    </div>
  );
}
