import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Building, Check, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router";
import { ApiError, toApiError } from "../api/errors";
import { Button, FormField } from "../components/ui";
import { useAction } from "../hooks/useAction";
import { useApiQuery } from "../hooks/useApiQuery";
import { authService } from "../services/authService";
import type { InstitutionType, SignupRequest } from "../services/authService";
import AuthCardLink from "./AuthCardLink";

const noVerification = { codeExpiresAt: 0, resendAt: 0, token: "", tokenExpiresAt: 0 };
const secondsLeft = (until: number, now: number) => Math.max(0, Math.ceil((until - now) / 1000));
const sixDigits = /^[0-9]{6}$/;
const researcherNoPattern = /^[0-9]{8}$/;
const fieldLabels: Record<string, string> = {
  email: "이메일",
  code: "인증 코드",
  name: "이름",
  phone: "개인 연락처",
  password: "비밀번호",
  role: "가입 유형",
  researcherNo: "국가연구자번호",
  organizationId: "소속 기관·대학",
  "organization.name": "조직 이름",
  "organization.businessRegNo": "사업자등록번호",
  "organization.orgType": "조직 유형",
  "organization.address": "소속 조직 주소",
  "organization.phone": "소속 조직 연락처",
};

function signupRequest(
  form: FormData,
  email: string,
  verificationToken: string,
  role: SignupRequest["role"],
  existing: boolean,
  institutionIds: number[],
): SignupRequest {
  const read = (field: string) => String(form.get(field) ?? "").trim();
  const required = (field: string, message: string) => {
    const value = read(field);
    if (!value) throw new ApiError(message, { code: "VALIDATION_FAILED" });
    return value;
  };
  const phone = read("phone");
  const password = String(form.get("password") ?? "");
  if (!password) throw new ApiError("비밀번호를 입력해주세요.", { code: "VALIDATION_FAILED" });
  const applicant = {
    email,
    verificationToken,
    password,
    name: required("name", "이름을 입력해주세요."),
    ...(phone ? { phone } : {}),
  };
  if (role === "COMPANY_USER") {
    const input = read("businessRegNo");
    const digits = input.replaceAll("-", "");
    if (!/^[0-9]{10}$/.test(digits))
      throw new ApiError("사업자등록번호는 숫자 10자리를 입력해주세요.", { code: "VALIDATION_FAILED" });
    return {
      ...applicant,
      role,
      organization: {
        name: required("companyName", "회사명을 입력해주세요."),
        businessRegNo: `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`,
      },
    };
  }
  const researcherNo = read("researcherNo");
  if (!researcherNoPattern.test(researcherNo))
    throw new ApiError("국가연구자번호는 숫자 8자리를 입력해주세요.", { code: "VALIDATION_FAILED" });
  if (existing) {
    const organizationId = Number(read("organizationId"));
    if (!institutionIds.includes(organizationId))
      throw new ApiError("가입할 기관 또는 대학을 선택해주세요.", { code: "VALIDATION_FAILED" });
    return { ...applicant, role, researcherNo, organizationId };
  }
  const orgType: InstitutionType = read("orgType") === "UNIVERSITY" ? "UNIVERSITY" : "INSTITUTION";
  return {
    ...applicant,
    role,
    researcherNo,
    organization: {
      orgType,
      name: required("organizationName", "기관 또는 대학 이름을 입력해주세요."),
      address: required("address", "소속 조직의 주소를 입력해주세요."),
      phone: required("organizationPhone", "소속 조직의 연락처를 입력해주세요."),
    },
  };
}

export default function SignupPage() {
  const navigate = useNavigate();
  const emailInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<SignupRequest["role"]>("COMPANY_USER");
  const [existing, setExisting] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [verification, setVerification] = useState(noVerification);
  const [now, setNow] = useState(Date.now);
  const action = useAction();
  const selectInstitution = role === "INSTITUTION_MANAGER" && existing;
  const institutions = useApiQuery(authService.institutions, "signup-institutions", selectInstitution);
  const resendSeconds = secondsLeft(verification.resendAt, now);
  const codeSeconds = secondsLeft(verification.codeExpiresAt, now);
  const verified = Boolean(verification.token) && verification.tokenExpiresAt > now;
  const ticking = verified || resendSeconds > 0 || codeSeconds > 0;

  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const updateEmail = (value: string) => {
    setEmail(value);
    setCode("");
    setVerification(noVerification);
    action.clearFeedback();
  };

  const sendCode = () => {
    if (!emailInput.current?.reportValidity() || verification.resendAt > Date.now()) return;
    void action.run(async (signal) => {
      try {
        const result = await authService.sendVerification(email.trim(), signal);
        if (signal.aborted) return;
        const sentAt = Date.now();
        setNow(sentAt);
        setVerification({
          ...noVerification,
          codeExpiresAt: sentAt + result.expiresIn * 1000,
          resendAt: sentAt + result.resendAvailableIn * 1000,
        });
        setCode("");
      } catch (failure) {
        const error = toApiError(failure);
        if (error.code === "TOO_MANY_REQUESTS" && error.details?.retryAfter != null) {
          const rejectedAt = Date.now();
          setNow(rejectedAt);
          setVerification((previous) => ({
            ...previous,
            resendAt: rejectedAt + error.details.retryAfter * 1000,
          }));
        }
        throw error;
      }
    });
  };

  const confirmCode = () => {
    if (!sixDigits.test(code) || verification.codeExpiresAt <= Date.now()) return;
    void action.run(async (signal) => {
      try {
        const result = await authService.confirmVerification(email.trim(), code, signal);
        if (signal.aborted) return;
        const confirmedAt = Date.now();
        setNow(confirmedAt);
        setCode("");
        setVerification((previous) => ({
          ...previous,
          codeExpiresAt: 0,
          token: result.verificationToken,
          tokenExpiresAt: confirmedAt + result.expiresIn * 1000,
        }));
      } catch (failure) {
        const error = toApiError(failure);
        if (error.code === "VERIFICATION_CODE_EXPIRED" || error.details?.remainingAttempts === 0) {
          setCode("");
          setVerification((previous) => ({ ...previous, codeExpiresAt: 0 }));
        }
        if (error.details?.remainingAttempts === 0)
          throw new ApiError("인증 시도 횟수를 모두 사용했습니다. 코드를 다시 받으세요.", { code: "VERIFICATION_CODE_EXPIRED" });
        throw error;
      }
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verified || verification.tokenExpiresAt <= Date.now()) return;
    if (password.length < 8 || password !== passwordConfirm) return;
    const form = new FormData(event.currentTarget);
    void action.run(async (signal) => {
      const request = signupRequest(form, email.trim(), verification.token, role, existing, institutions.data?.map(({ id }) => id) ?? []);
      try {
        await authService.signup(request, signal);
        if (!signal.aborted) navigate("/auth/login", { replace: true, state: { signupPending: true } });
      } catch (failure) {
        const error = toApiError(failure);
        if (error.code === "EMAIL_NOT_VERIFIED") {
          setCode("");
          setVerification((previous) => ({ ...noVerification, resendAt: previous.resendAt }));
        }
        throw error;
      }
    });
  };

  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  const strength = Math.min(3, [/[A-Za-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length + (password.length >= 12 ? 1 : 0));
  const step = !verified ? 1 : 2;

  return (
    <div className="login-card login-card--signup">
      <h1 id="auth-card-heading" tabIndex={-1}>회원가입</h1>
      <p className="login-card__intro">관리자 승인 후 로그인할 수 있습니다.</p>
      <ol className="signup-steps" aria-label="가입 단계">
        <li className={step === 1 ? "is-current" : "is-done"}><span>{step > 1 ? <Check size={13} /> : 1}</span>이메일 인증</li>
        <li className={step === 2 ? "is-current" : undefined}><span>2</span>정보 입력</li>
        <li><span>3</span>관리자 승인</li>
      </ol>
      <form onSubmit={submit} aria-busy={action.busy}>
        <fieldset disabled={action.busy} className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0">
          <section className="signup-section">
            <h2>가입 유형</h2>
            <div className="signup-roles" role="radiogroup" aria-label="가입 유형">
              {([
                ["COMPANY_USER", Building, "기업 회원", "장비를 찾고 시험을 의뢰합니다"],
                ["INSTITUTION_MANAGER", FlaskConical, "기관·대학 담당자", "보유 장비를 등록하고 의뢰를 처리합니다"],
              ] as const).map(([value, Icon, title, description]) => (
                <label key={value} className={`signup-role${role === value ? " is-selected" : ""}`}>
                  <input type="radio" name="signup-role" value={value} checked={role === value} onChange={() => setRole(value)} />
                  <span className="signup-role__icon"><Icon size={20} aria-hidden="true" /></span>
                  <span><strong>{title}</strong><small>{description}</small></span>
                  <span className="signup-role__check" aria-hidden="true"><Check size={14} /></span>
                </label>
              ))}
            </div>
          </section>

          <section className="signup-section">
            <h2>이메일 인증 <span className="signup-required">필수</span></h2>
            <div className={`signup-inline${verified ? " is-verified" : ""}`}>
              <label className="sr-only" htmlFor="signup-email">이메일</label>
              <input id="signup-email" ref={emailInput} type="email" autoComplete="username" required value={email}
                placeholder="name@company.com" onChange={(event) => updateEmail(event.target.value)} />
              {verified ? (
                <span className="signup-verified"><Check size={15} aria-hidden="true" />인증 완료</span>
              ) : (
                <Button variant="secondary" onClick={sendCode} disabled={!email.trim() || resendSeconds > 0}>
                  {resendSeconds > 0 ? `${resendSeconds}초 후 재발송` : codeSeconds > 0 ? "코드 다시 받기" : "인증 코드 받기"}
                </Button>
              )}
            </div>
            {!verified && codeSeconds > 0 && (
              <div className="signup-inline signup-inline--code">
                <label className="sr-only" htmlFor="signup-code">인증 코드 6자리</label>
                <input id="signup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} placeholder="인증 코드 6자리"
                  onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))} />
                <span className="signup-timer">{Math.floor(codeSeconds / 60)}:{String(codeSeconds % 60).padStart(2, "0")}</span>
                <Button onClick={confirmCode} disabled={!sixDigits.test(code)}>확인</Button>
              </div>
            )}
            {!verified && (verification.codeExpiresAt > 0 || verification.tokenExpiresAt > 0) && codeSeconds === 0 && (
              <p className="signup-hint signup-hint--warn" role="status">인증 시간이 지났습니다. 코드를 다시 받아주세요.</p>
            )}
          </section>

          <section className={`signup-section${verified ? "" : " is-locked"}`}>
            <h2>계정 정보</h2>
            <div className="form-grid">
              <FormField id="signup-name" label="이름 *">
                <input id="signup-name" name="name" autoComplete="name" required />
              </FormField>
              <FormField id="signup-phone" label="연락처">
                <input id="signup-phone" name="phone" type="tel" autoComplete="tel" placeholder="010-0000-0000" />
              </FormField>
              <FormField id="signup-password" label="비밀번호 *"
                hint={passwordTooShort ? <span className="signup-hint--warn">8자 이상 입력해주세요.</span> : "8자 이상 · 영문, 숫자, 특수문자 조합 권장"}>
                <input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8}
                  value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={passwordTooShort || undefined} />
                {password && <span className={`signup-strength signup-strength--${strength}`} aria-label={`비밀번호 강도 ${["약함", "보통", "좋음", "강함"][strength]}`}><i /><i /><i /></span>}
              </FormField>
              <FormField id="signup-password-confirm" label="비밀번호 확인 *"
                hint={passwordMismatch ? <span className="signup-hint--warn">비밀번호가 일치하지 않습니다.</span>
                  : passwordConfirm && !passwordTooShort ? <span className="signup-hint--ok">비밀번호가 일치합니다.</span> : undefined}>
                <input id="signup-password-confirm" type="password" autoComplete="new-password" required
                  value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} aria-invalid={passwordMismatch || undefined} />
              </FormField>
            </div>
          </section>

          <section className={`signup-section${verified ? "" : " is-locked"}`}>
            <h2>{role === "COMPANY_USER" ? "회사 정보" : "소속 기관·대학"}</h2>
            <div className="form-grid">
            {role === "COMPANY_USER" ? (
              <>
                <FormField id="signup-company" label="회사명 *">
                  <input id="signup-company" name="companyName" required />
                </FormField>
                <FormField id="signup-business" label="사업자등록번호 *" hint="숫자 10자리 · 하이픈 입력 가능">
                  <input id="signup-business" name="businessRegNo" inputMode="numeric" required placeholder="000-00-00000" />
                </FormField>
              </>
            ) : (
              <>
                <FormField id="signup-researcher-no" label="국가연구자번호 *" className="form-field--full"
                  hint={<span id="signup-researcher-no-hint">발급받은 번호 8자리를 입력해주세요.</span>}>
                  <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                    <input
                      id="signup-researcher-no"
                      name="researcherNo"
                      className="tw:min-w-0 tw:grow tw:basis-52"
                      inputMode="numeric"
                      pattern={researcherNoPattern.source}
                      aria-describedby="signup-researcher-no-hint"
                      required
                    />
                    <a
                      className="button button--secondary tw:shrink-0"
                      href="https://www.iris.go.kr/mbrs/srch/retrieveSrchNumInfo.do"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="IRIS에서 국가연구자번호 조회 (새 탭)"
                    >
                      IRIS에서 조회
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </a>
                  </div>
                </FormField>
                <div className="form-field form-field--full">
                  <div className="segmented signup-affiliation" role="group" aria-label="소속 등록 방식">
                    <button type="button" aria-pressed={existing} onClick={() => setExisting(true)}>등록된 기관·대학 선택</button>
                    <button type="button" aria-pressed={!existing} onClick={() => setExisting(false)}>새 기관·대학 신청</button>
                  </div>
                </div>
                {existing ? (
                  <FormField id="signup-institution" label="소속 기관·대학 *" className="form-field--full"
                    hint={institutions.data?.length === 0 ? "등록된 기관·대학이 없습니다. ‘새 기관·대학 신청’을 이용해주세요." : undefined}>
                    <select id="signup-institution" name="organizationId" defaultValue="" required disabled={!institutions.data?.length}>
                      <option value="" disabled>{institutions.loading ? "불러오는 중…" : "기관·대학 선택"}</option>
                      {institutions.data?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.orgType === "UNIVERSITY" ? "대학" : "기관"}{item.region ? ` · ${item.region}` : ""})
                        </option>
                      ))}
                    </select>
                    {institutions.error && (
                      <p className="signup-hint signup-hint--warn" role="alert">
                        기관·대학 목록을 불러오지 못했습니다.{" "}
                        <button type="button" className="text-link" onClick={institutions.reload}>다시 시도</button>
                      </p>
                    )}
                  </FormField>
                ) : (
                  <>
                    <FormField id="signup-org-type" label="조직 유형 *">
                      <select id="signup-org-type" name="orgType"><option value="INSTITUTION">기관</option><option value="UNIVERSITY">대학</option></select>
                    </FormField>
                    <FormField id="signup-org-name" label="기관·대학 이름 *">
                      <input id="signup-org-name" name="organizationName" required />
                    </FormField>
                    <FormField id="signup-org-address" label="주소 *">
                      <input id="signup-org-address" name="address" required />
                    </FormField>
                    <FormField id="signup-org-phone" label="대표 연락처 *">
                      <input id="signup-org-phone" name="organizationPhone" type="tel" required />
                    </FormField>
                  </>
                )}
              </>
            )}
            </div>
          </section>
        </fieldset>
        {action.error && (
          <div className="content-note" role="alert">
            <div>
              {action.error.message}
              {action.error.details?.remainingAttempts > 0 && ` 남은 시도 ${action.error.details.remainingAttempts}회.`}
              {Object.entries(action.error.details?.fieldErrors ?? {}).map(([field, message]) =>
                Object.hasOwn(fieldLabels, field) && <p key={field}>{fieldLabels[field]} · {message}</p>
              )}
            </div>
          </div>
        )}
        <button type="submit" className="login-submit signup-submit"
          disabled={!verified || action.busy || passwordTooShort || passwordMismatch || !passwordConfirm || (selectInstitution && !institutions.data?.length)}>
          {action.busy ? "가입 신청 중…" : "가입 신청하기"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
        {!verified && <p className="signup-hint signup-hint--center">이메일 인증을 완료하면 가입을 신청할 수 있습니다.</p>}
        <p className="signup-footer">이미 계정이 있나요? <AuthCardLink className="login-signup-link" to="/auth/login">로그인</AuthCardLink></p>
      </form>
    </div>
  );
}
