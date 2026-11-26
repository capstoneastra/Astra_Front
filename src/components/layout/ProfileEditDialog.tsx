import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, UserRound, X } from "lucide-react";
import { useAuth } from "../../auth/context";
import { authService } from "../../services/authService";
import type { User } from "../../services/authService";
import { useAction } from "../../hooks/useAction";
import { roleLabels } from "../../domain/constants";
import { Button, FormField } from "../ui";
import { Feedback } from "../workflow/Feedback";

/**
 * 내 정보 수정 (프로필 메뉴 → [정보 수정])
 * - 기본 정보: PATCH /users/me { name?, phone? } — 바뀐 값만 보내고, 응답으로 화면의 사용자 정보를 바로 바꿈
 * - 비밀번호 변경: PATCH /users/me/password { currentPassword, newPassword } — 로그인 상태는 그대로
 *   규칙은 회원가입과 같음: 8~72자, UTF-8 72바이트 이하 (docs/api-spec.md 1)
 * 이메일(아이디)·소속·역할은 여기서 바꿀 수 없어 읽기 전용으로 보여줍니다.
 */
export default function ProfileEditDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { updateUser } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const role = user.organization?.orgType === "UNIVERSITY" && user.role === "INSTITUTION_MANAGER" ? "대학 담당자" : roleLabels[user.role];

  // ── 기본 정보 ──
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const info = useAction();
  const changes: { name?: string; phone?: string } = {};
  if (name.trim() !== (user.name ?? "")) changes.name = name.trim();
  if (phone.trim() !== (user.phone ?? "")) changes.phone = phone.trim();
  const canSaveInfo = !!name.trim() && Object.keys(changes).length > 0 && !info.busy;
  const saveInfo = (event: FormEvent) => {
    event.preventDefault();
    if (!canSaveInfo) return;
    void info.run(async (signal) => updateUser(await authService.updateMe(changes, signal)), "내 정보를 저장했습니다.");
  };

  // ── 비밀번호 ──
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const password = useAction();
  const tooShort = next.length > 0 && next.length < 8;
  const tooLong = new TextEncoder().encode(next).length > 72;
  const mismatch = confirm.length > 0 && next !== confirm;
  const sameAsCurrent = next.length > 0 && next === current;
  const canChange = !!current && next.length >= 8 && !tooLong && next === confirm && !sameAsCurrent && !password.busy;
  const changePassword = (event: FormEvent) => {
    event.preventDefault();
    if (!canChange) return;
    void password.run(async (signal) => {
      await authService.changePassword(current, next, signal);
      setCurrent(""); setNext(""); setConfirm("");
    }, "비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.");
  };
  const newHint = tooShort ? <span className="profile-dialog__warn">8자 이상 입력해 주세요.</span>
    : tooLong ? <span className="profile-dialog__warn">너무 깁니다. 72바이트(한글 약 24자) 이하로 입력해 주세요.</span>
    : sameAsCurrent ? <span className="profile-dialog__warn">현재 비밀번호와 다르게 입력해 주세요.</span>
    : "8~72자 · 회원가입과 같은 규칙";

  return (
    <dialog ref={dialog} className="dialog profile-dialog" aria-labelledby="profile-edit-title" onClose={onClose}
      onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
      <div className="dialog__heading">
        <h2 id="profile-edit-title">내 정보 수정</h2>
        <button type="button" className="icon-button" aria-label="내 정보 수정 닫기" onClick={() => dialog.current?.close()}><X size={20} /></button>
      </div>

      <dl className="profile-dialog__fixed" aria-label="바꿀 수 없는 정보">
        <div><dt>이메일(아이디)</dt><dd>{user.email}</dd></div>
        <div><dt>소속</dt><dd>{user.organization?.name || "소속 없음"}</dd></div>
        <div><dt>역할</dt><dd>{role}</dd></div>
      </dl>

      <form className="profile-dialog__section" onSubmit={saveInfo}>
        <h3><UserRound size={15} aria-hidden="true" />기본 정보</h3>
        <div className="profile-dialog__grid">
          <FormField label="이름" id="profile-name" hint={!name.trim() ? <span className="profile-dialog__warn">이름을 입력해 주세요.</span> : undefined}>
            <input id="profile-name" value={name} autoComplete="name" required maxLength={50}
              onChange={(e) => { setName(e.target.value); info.clearFeedback(); }} />
          </FormField>
          <FormField label="연락처" id="profile-phone" hint="전화번호 (예: 010-0000-0000)">
            <input id="profile-phone" type="tel" value={phone} autoComplete="tel" maxLength={30}
              onChange={(e) => { setPhone(e.target.value); info.clearFeedback(); }} />
          </FormField>
        </div>
        <Feedback action={info} />
        <div className="dialog__actions">
          <Button type="submit" disabled={!canSaveInfo}>{info.busy ? "저장 중…" : "정보 저장"}</Button>
        </div>
      </form>

      <form className="profile-dialog__section" onSubmit={changePassword}>
        <h3><KeyRound size={15} aria-hidden="true" />비밀번호 변경</h3>
        {/* 브라우저 비밀번호 관리자가 어느 계정의 비밀번호인지 알 수 있게 */}
        <input type="text" autoComplete="username" value={user.email ?? ""} readOnly hidden />
        <div className="profile-dialog__grid">
          <FormField label="현재 비밀번호" id="profile-current" className="profile-dialog__wide">
            <input id="profile-current" type="password" value={current} autoComplete="current-password"
              onChange={(e) => { setCurrent(e.target.value); password.clearFeedback(); }} />
          </FormField>
          <FormField label="새 비밀번호" id="profile-new" hint={newHint}>
            <input id="profile-new" type="password" value={next} autoComplete="new-password" minLength={8}
              onChange={(e) => { setNext(e.target.value); password.clearFeedback(); }} />
          </FormField>
          <FormField label="새 비밀번호 확인" id="profile-confirm" hint={mismatch ? <span className="profile-dialog__warn">새 비밀번호와 다릅니다.</span> : undefined}>
            <input id="profile-confirm" type="password" value={confirm} autoComplete="new-password"
              onChange={(e) => { setConfirm(e.target.value); password.clearFeedback(); }} />
          </FormField>
        </div>
        <Feedback action={password} />
        <div className="dialog__actions">
          <Button type="submit" variant="secondary" disabled={!canChange}>{password.busy ? "바꾸는 중…" : "비밀번호 변경"}</Button>
        </div>
      </form>
    </dialog>
  );
}
