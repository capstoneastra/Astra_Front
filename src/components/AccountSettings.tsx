import { useState } from "react";
import { Bell, Check, LayoutGrid, List, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../auth/context";
import { apiConfig } from "../api/config";
import { profileService } from "../services/profileService";
import { profileErrors } from "../domain/profile";
import { roleLabels, accountStatusLabels } from "../domain/constants";
import { useAction } from "../hooks/useAction";
import { useTheme } from "../theme/useTheme";
import { Badge, Button, FormField, PageHeader, Panel } from "./ui";
import { Feedback } from "./workflow/Feedback";

export default function AccountSettings({ onNavigate }: { onNavigate: (menu: string) => void }) {
  const { user, checkSession, logout } = useAuth();
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone ?? "" });
  const [submitted, setSubmitted] = useState(false);
  const [view, setView] = useState(() => { try { return localStorage.getItem("astra.equipment-view.v1") === "cards" ? "cards" : "list"; } catch { return "list"; } });
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const { theme, toggleTheme } = useTheme();
  const action = useAction();
  const errors = profileErrors(profile);
  const dirty = profile.name.trim() !== user.name || profile.phone.trim() !== (user.phone ?? "");
  function setField(field: "name" | "phone", value: string) { setProfile(previous => ({ ...previous, [field]: value })); action.clearFeedback(); }
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitted(true);
    if (Object.keys(errors).length || !dirty || action.busy) return;
    await action.run(async signal => {
      const updated = await profileService.update(profile, user, signal);
      setProfile({ name: updated.name, phone: updated.phone ?? "" });
      await checkSession();
    }, "프로필을 저장했습니다.");
  };
  return <div className="content-page page-enter account-settings">
    <PageHeader eyebrow="ACCOUNT & PREFERENCES" title="계정 및 설정" description="내 정보와 작업 환경을 한곳에서 관리하세요." />
    <div className="settings-grid">
      <Panel className="settings-profile" title="프로필 수정" action={<Badge tone="cyan"><UserRound size={12} />내 계정</Badge>}>
        <form className="settings-body" onSubmit={save} noValidate>
          <div className="settings-person"><span className="settings-avatar">{profile.name.trim().slice(0, 1) || "A"}</span><div><strong>{user.name}</strong><small>{user.organization?.name ?? "ASTRA 플랫폼 운영"}</small></div><Badge tone="cyan">{roleLabels[user.role]}</Badge></div>
          <div className="settings-form-grid">
            <FormField id="profile-name" label="담당자 이름"><input id="profile-name" autoComplete="name" maxLength={100} value={profile.name} onChange={e => setField("name", e.target.value)} disabled={action.busy} aria-invalid={submitted && Boolean(errors.name)} aria-describedby={submitted && errors.name ? "profile-name-error" : undefined} />{submitted && errors.name && <small className="settings-field-error" id="profile-name-error">{errors.name}</small>}</FormField>
            <FormField id="profile-phone" label="연락처 (선택)"><input id="profile-phone" type="tel" autoComplete="tel" maxLength={30} placeholder="010-0000-0000" value={profile.phone} onChange={e => setField("phone", e.target.value)} disabled={action.busy} aria-invalid={submitted && Boolean(errors.phone)} aria-describedby={submitted && errors.phone ? "profile-phone-error" : undefined} />{submitted && errors.phone && <small className="settings-field-error" id="profile-phone-error">{errors.phone}</small>}</FormField>
          </div>
          <Feedback action={action} />
          <div className="settings-save"><span>{apiConfig.isMock ? "DEMO · 이 브라우저에 계정별로 저장됩니다." : "저장 시 내 계정 정보에 반영됩니다."}</span><Button variant="ghost" disabled={!dirty || action.busy} onClick={() => { setProfile({ name: user.name, phone: user.phone ?? "" }); setSubmitted(false); action.clearFeedback(); }}>변경 취소</Button><Button type="submit" icon={Save} disabled={!dirty || action.busy}>{action.busy ? "저장 중…" : "변경사항 저장"}</Button></div>
        </form>
      </Panel>
      <Panel title="계정 정보" className="settings-account">
        <dl className="settings-facts"><div><dt>이메일</dt><dd>{user.email}</dd></div><div><dt>회원 유형</dt><dd>{roleLabels[user.role]}</dd></div><div><dt>소속 기업·기관</dt><dd>{user.organization?.name ?? "플랫폼 운영"}</dd></div><div><dt>계정 상태</dt><dd><Badge tone={user.status === "ACTIVE" ? "cyan" : "amber"}>{accountStatusLabels[user.status] ?? user.status}</Badge></dd></div><div><dt>소속 승인</dt><dd>{user.organization ? user.organization.isVerified == null ? "확인 필요" : user.organization.isVerified ? "승인됨" : "승인 대기" : "해당 없음"}</dd></div></dl>
        <p className="settings-hint"><LockKeyhole size={13} />이메일·회원 유형·소속 변경은 관리자에게 요청해주세요.</p>
      </Panel>
      <Panel title="화면 및 작업 환경">
        <div className="settings-body"><div className="settings-option"><div><strong>화면 테마</strong><small>선택한 테마를 이 브라우저에 적용합니다.</small></div><div className="settings-segment" aria-label="화면 테마">{["dark", "light"].map(value => <button key={value} type="button" aria-pressed={theme === value} onClick={() => { if (theme !== value) toggleTheme(); }}>{theme === value && <Check size={13} />}{value === "dark" ? "다크" : "라이트"}</button>)}</div></div>
          <div className="settings-option"><div><strong>장비 검색 기본 보기</strong><small>다음 검색 화면부터 적용됩니다.</small></div><div className="settings-segment" aria-label="장비 검색 기본 보기">{[{ value: "cards", label: "카드", icon: LayoutGrid }, { value: "list", label: "목록", icon: List }].map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-pressed={view === value} onClick={() => { try { localStorage.setItem("astra.equipment-view.v1", value); setView(value); setPreferenceMessage("기본 보기 설정을 저장했습니다."); } catch { setPreferenceMessage("브라우저 저장소를 사용할 수 없어 설정을 저장하지 못했습니다."); } }}><Icon size={14} />{label}</button>)}</div></div>
          {preferenceMessage && <p className="settings-hint" role="status">{preferenceMessage}</p>}
          <div className="settings-option"><div><strong>일정 시간대</strong><small>모든 시험·예약 일정에 공통 적용</small></div><span className="settings-mono">Asia/Seoul · UTC+9</span></div>
          <Button icon={Bell} variant="ghost" onClick={() => onNavigate("notifications")}>내 업무 알림 확인</Button>
        </div>
      </Panel>
      <Panel title="보안 및 접속 환경">
        <div className="settings-body"><div className="settings-option"><div><strong><ShieldCheck size={15} />현재 접속</strong><small>{apiConfig.isPublicDemo ? "공개 시연 DEMO 세션 · 실제 인증이 아닙니다." : apiConfig.isMock ? "개발 전용 DEMO 세션 · 실제 인증이 아닙니다." : "서버 인증 계정 · 권한과 소속을 기준으로 접근"}</small></div><Badge tone={apiConfig.isMock ? "amber" : "cyan"}>{apiConfig.isMock ? "DEMO" : "API"}</Badge></div>
          <div className="settings-option"><div><strong>비밀번호 변경</strong><small>현재 API 명세에 변경 기능이 없어 연동 후 제공됩니다.</small></div><Badge>연동 대기</Badge></div>
          <div className="settings-option"><div><strong>현재 기기 로그아웃</strong><small>접속을 종료하고 로그인 화면으로 이동합니다.</small></div><Button variant="secondary" onClick={logout}>로그아웃</Button></div>
        </div>
      </Panel>
    </div>
  </div>;
}
