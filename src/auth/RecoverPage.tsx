import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check, KeyRound, UserRound } from "lucide-react";
import { useNavigate } from "react-router";
import { ApiError, toApiError } from "../api/errors";
import { Button, FormField } from "../components/ui";
import { useAction } from "../hooks/useAction";
import { authService } from "../services/authService";
import AuthCardLink from "./AuthCardLink";

/*
 * v17: 계정 찾기 — 이메일(아이디) 찾기 / 비밀번호 재설정
 * API: docs/api-spec.md 1-1 (POST /auth/find-email, /auth/password-resets, …/confirm, …/complete)
 */
type Mode = "email" | "password";
const sixDigits = /^[0-9]{6}$/;
const secondsLeft = (until: number, now: number) => Math.max(0, Math.ceil((until - now) / 1000));
const noCode = { codeExpiresAt: 0, resendAt: 0, token: "", tokenExpiresAt: 0 };

export default function RecoverPage() {
  const [mode, setMode] = useState<Mode>("password");
  return (
    <div className="login-card login-card--signup login-card--recover">
      <h1 id="auth-card-heading" tabIndex={-1}>계정 찾기</h1>
      <p className="login-card__intro">가입할 때 입력한 정보로 이메일(아이디)을 찾거나 비밀번호를 새로 정할 수 있어요.</p>
      <div className="recover-tabs" role="tablist" aria-label="찾을 항목">
        {([["password", KeyRound, "비밀번호 재설정"], ["email", UserRound, "이메일(아이디) 찾기"]] as const).map(([value, Icon, label]) => (
          <button key={value} type="button" role="tab" id={`recover-tab-${value}`} aria-selected={mode === value}
            aria-controls="recover-panel" onClick={() => setMode(value)}>
            <Icon size={15} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      <div id="recover-panel" role="tabpanel" aria-labelledby={`recover-tab-${mode}`}>
        {mode === "email" ? <FindEmail onReset={() => setMode("password")} /> : <ResetPassword />}
      </div>
      <p className="signup-footer">비밀번호가 기억났나요? <AuthCardLink className="login-signup-link" to="/auth/login">로그인</AuthCardLink></p>
    </div>
  );
}

function FindEmail({ onReset }: { onReset: () => void }) {
  const action = useAction();
  const [found, setFound] = useState<string[] | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    void action.run(async (signal) => {
      if (!name || !phone) throw new ApiError("이름과 연락처를 모두 입력해 주세요.", { code: "VALIDATION_FAILED" });
      const emails = await authService.findEmail(name, phone, signal);
      if (!signal.aborted) setFound(emails);
    });
  };

  return (
    <form className="recover-form" onSubmit={submit} aria-busy={action.busy} onChange={() => { setFound(null); action.clearFeedback(); }}>
      <fieldset disabled={action.busy} className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0">
        <div className="form-grid">
          <FormField id="recover-name" label="이름 *">
            <input id="recover-name" name="name" autoComplete="name" required />
          </FormField>
          <FormField id="recover-phone" label="연락처 *">
            <input id="recover-phone" name="phone" type="tel" autoComplete="tel" placeholder="010-0000-0000" required />
          </FormField>
        </div>
      </fieldset>
      {action.error && <p className="content-note" role="alert">{action.error.message}</p>}
      {found && (
        <div className="recover-result" role="status">
          {found.length ? (
            <>
              <p>입력한 정보로 가입한 이메일이에요. 보안을 위해 일부는 가려서 보여 드려요.</p>
              <ul>{found.map((email) => <li key={email}><UserRound size={14} aria-hidden="true" />{email}</li>)}</ul>
              <div className="recover-result__actions">
                <AuthCardLink className="login-signup-link" to="/auth/login">이 이메일로 로그인</AuthCardLink>
                <button type="button" className="text-link" onClick={onReset}>비밀번호를 잊었어요</button>
              </div>
            </>
          ) : (
            <p>일치하는 계정을 찾지 못했어요. 가입할 때 연락처를 넣지 않았다면 플랫폼 관리자에게 문의해 주세요.</p>
          )}
        </div>
      )}
      <button type="submit" className="login-submit signup-submit" disabled={action.busy}>
        {action.busy ? "찾는 중…" : "이메일 찾기"}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </form>
  );
}

function ResetPassword() {
  const navigate = useNavigate();
  const action = useAction();
  const emailInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [state, setState] = useState(noCode);
  const [now, setNow] = useState(Date.now);
  const resendSeconds = secondsLeft(state.resendAt, now);
  const codeSeconds = secondsLeft(state.codeExpiresAt, now);
  const verified = Boolean(state.token) && state.tokenExpiresAt > now;
  const ticking = verified || resendSeconds > 0 || codeSeconds > 0;

  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const updateEmail = (value: string) => {
    setEmail(value);
    setCode("");
    setState(noCode);
    action.clearFeedback();
  };

  const sendCode = () => {
    if (!emailInput.current?.reportValidity() || state.resendAt > Date.now()) return;
    void action.run(async (signal) => {
      try {
        const result = await authService.sendPasswordReset(email.trim(), signal);
        if (signal.aborted) return;
        const sentAt = Date.now();
        setNow(sentAt);
        setState({ ...noCode, codeExpiresAt: sentAt + result.expiresIn * 1000, resendAt: sentAt + result.resendAvailableIn * 1000 });
        setCode("");
      } catch (failure) {
        const error = toApiError(failure);
        if (error.code === "TOO_MANY_REQUESTS" && error.details?.retryAfter != null) {
          const rejectedAt = Date.now();
          setNow(rejectedAt);
          setState((previous) => ({ ...previous, resendAt: rejectedAt + error.details.retryAfter * 1000 }));
        }
        throw error;
      }
    }, "가입된 이메일이면 재설정 코드를 보냈어요. 메일함을 확인해 주세요.");
  };

  const confirmCode = () => {
    if (!sixDigits.test(code) || state.codeExpiresAt <= Date.now()) return;
    void action.run(async (signal) => {
      try {
        const result = await authService.confirmPasswordReset(email.trim(), code, signal);
        if (signal.aborted) return;
        const confirmedAt = Date.now();
        setNow(confirmedAt);
        setCode("");
        setState((previous) => ({ ...previous, codeExpiresAt: 0, token: result.resetToken, tokenExpiresAt: confirmedAt + result.expiresIn * 1000 }));
      } catch (failure) {
        const error = toApiError(failure);
        if (error.code === "VERIFICATION_CODE_EXPIRED" || error.details?.remainingAttempts === 0) {
          setCode("");
          setState((previous) => ({ ...previous, codeExpiresAt: 0 }));
        }
        if (error.details?.remainingAttempts === 0)
          throw new ApiError("인증 시도 횟수를 모두 사용했습니다. 코드를 다시 받으세요.", { code: "VERIFICATION_CODE_EXPIRED" });
        throw error;
      }
    });
  };

  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verified || password.length < 8 || password !== passwordConfirm) return;
    void action.run(async (signal) => {
      try {
        await authService.completePasswordReset(state.token, password, signal);
        if (!signal.aborted) navigate("/auth/login", { replace: true, state: { passwordReset: true, email: email.trim() } });
      } catch (failure) {
        const error = toApiError(failure);
        if (error.code === "RESET_TOKEN_INVALID") setState((previous) => ({ ...noCode, resendAt: previous.resendAt }));
        throw error;
      }
    });
  };
  const step = verified ? 2 : 1;

  return (
    <form className="recover-form" onSubmit={submit} aria-busy={action.busy}>
      <ol className="signup-steps" aria-label="재설정 단계">
        <li className={step === 1 ? "is-current" : "is-done"}><span>{step > 1 ? <Check size={13} /> : 1}</span>이메일 확인</li>
        <li className={step === 2 ? "is-current" : undefined}><span>2</span>새 비밀번호</li>
      </ol>
      <fieldset disabled={action.busy} className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0">
        <section className="signup-section">
          <h2>가입한 이메일</h2>
          <div className={`signup-inline${verified ? " is-verified" : ""}`}>
            <label className="sr-only" htmlFor="recover-email">이메일</label>
            <input id="recover-email" ref={emailInput} type="email" autoComplete="username" required value={email}
              placeholder="name@company.com" onChange={(event) => updateEmail(event.target.value)} />
            {verified ? (
              <span className="signup-verified"><Check size={15} aria-hidden="true" />확인 완료</span>
            ) : (
              <Button variant="secondary" onClick={sendCode} disabled={!email.trim() || resendSeconds > 0}>
                {resendSeconds > 0 ? `${resendSeconds}초 후 재발송` : codeSeconds > 0 ? "코드 다시 받기" : "재설정 코드 받기"}
              </Button>
            )}
          </div>
          {!verified && codeSeconds > 0 && (
            <div className="signup-inline signup-inline--code">
              <label className="sr-only" htmlFor="recover-code">재설정 코드 6자리</label>
              <input id="recover-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} placeholder="코드 6자리"
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))} />
              <span className="signup-timer">{Math.floor(codeSeconds / 60)}:{String(codeSeconds % 60).padStart(2, "0")}</span>
              <Button onClick={confirmCode} disabled={!sixDigits.test(code)}>확인</Button>
            </div>
          )}
          {!verified && state.codeExpiresAt > 0 && codeSeconds === 0 && (
            <p className="signup-hint signup-hint--warn" role="status">코드 유효 시간이 지났습니다. 다시 받아 주세요.</p>
          )}
        </section>
        <section className={`signup-section${verified ? "" : " is-locked"}`}>
          <h2>새 비밀번호</h2>
          <div className="form-grid">
            <FormField id="recover-password" label="새 비밀번호 *"
              hint={passwordTooShort ? <span className="signup-hint--warn">8자 이상 입력해 주세요.</span> : "8~72자 · 회원가입과 같은 규칙"}>
              <input id="recover-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={!verified}
                value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={passwordTooShort || undefined} />
            </FormField>
            <FormField id="recover-password-confirm" label="새 비밀번호 확인 *"
              hint={passwordMismatch ? <span className="signup-hint--warn">비밀번호가 일치하지 않습니다.</span>
                : passwordConfirm && !passwordTooShort ? <span className="signup-hint--ok">비밀번호가 일치합니다.</span> : undefined}>
              <input id="recover-password-confirm" type="password" autoComplete="new-password" required disabled={!verified}
                value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} aria-invalid={passwordMismatch || undefined} />
            </FormField>
          </div>
        </section>
      </fieldset>
      {action.error ? (
        <p className="content-note" role="alert">
          {action.error.message}
          {action.error.details?.remainingAttempts > 0 && ` 남은 시도 ${action.error.details.remainingAttempts}회.`}
        </p>
      ) : action.message && !verified ? <p className="signup-hint" role="status">{action.message}</p> : null}
      <button type="submit" className="login-submit signup-submit"
        disabled={!verified || action.busy || password.length < 8 || password !== passwordConfirm}>
        {action.busy && verified ? "바꾸는 중…" : "비밀번호 바꾸기"}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="signup-hint signup-hint--center">비밀번호를 바꾸면 다른 기기의 로그인은 모두 풀려요.</p>
    </form>
  );
}
