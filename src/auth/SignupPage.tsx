import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { ApiError, toApiError } from "../api/errors";
import { Button, FormField } from "../components/ui";
import ApiState from "../components/ui/ApiState";
import { useAction } from "../hooks/useAction";
import { useApiQuery } from "../hooks/useApiQuery";
import { authService } from "../services/authService";
import type { InstitutionType, SignupRequest } from "../services/authService";
import AuthCardLink from "./AuthCardLink";

const noVerification = { codeExpiresAt: 0, resendAt: 0, token: "", tokenExpiresAt: 0 };
const secondsLeft = (until: number, now: number) => Math.max(0, Math.ceil((until - now) / 1000));
const sixDigits = /^[0-9]{6}$/;
const fieldLabels: Record<string, string> = {
  email: "이메일",
  code: "인증 코드",
  name: "이름",
  phone: "개인 연락처",
  password: "비밀번호",
  role: "가입 유형",
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
  if (existing) {
    const organizationId = Number(read("organizationId"));
    if (!institutionIds.includes(organizationId))
      throw new ApiError("가입할 기관 또는 대학을 선택해주세요.", { code: "VALIDATION_FAILED" });
    return { ...applicant, role, organizationId };
  }
  const orgType: InstitutionType = read("orgType") === "UNIVERSITY" ? "UNIVERSITY" : "INSTITUTION";
  return {
    ...applicant,
    role,
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

  return (
    <div className="login-card login-card--signup">
      <h1 id="auth-card-heading" tabIndex={-1}>회원가입</h1>
      <p className="login-card__intro">
        이메일을 인증하고 가입을 신청하세요. 관리자 승인 후 로그인할 수 있습니다.
      </p>
      <form onSubmit={submit} aria-busy={action.busy}>
        <fieldset disabled={action.busy} className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0">
          <div className="form-grid">
            <FormField id="signup-email" label="이메일" className="form-field--full">
              <input id="signup-email" ref={emailInput} type="email" autoComplete="username" required value={email} onChange={(event) => updateEmail(event.target.value)} />
              {!verified && (
                <Button variant="secondary" onClick={sendCode} disabled={!email.trim() || resendSeconds > 0}>
                  {resendSeconds > 0 ? `${resendSeconds}초 후 다시 발송` : codeSeconds > 0 ? "인증 코드 다시 받기" : "인증 코드 받기"}
                </Button>
              )}
            </FormField>
            {verified && <p className="content-note form-field--full" role="status">이메일 인증을 완료했습니다.</p>}
            {!verified && codeSeconds > 0 && (
              <FormField id="signup-code" label="이메일 인증 코드" className="form-field--full"
                hint={`유효 시간 ${Math.floor(codeSeconds / 60)}분 ${codeSeconds % 60}초`}>
                <input id="signup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))} />
                <Button variant="secondary" onClick={confirmCode} disabled={!sixDigits.test(code)}>인증 코드 확인</Button>
              </FormField>
            )}
            {!verified && (verification.codeExpiresAt > 0 || verification.tokenExpiresAt > 0) && codeSeconds === 0 && (
              <p className="content-note form-field--full" role="status">이메일 인증 시간이 지났습니다. 인증 코드를 다시 받으세요.</p>
            )}
            <FormField id="signup-name" label="이름">
              <input id="signup-name" name="name" autoComplete="name" required />
            </FormField>
            <FormField id="signup-phone" label="개인 연락처 (선택)">
              <input id="signup-phone" name="phone" type="tel" autoComplete="tel" />
            </FormField>
            <FormField id="signup-password" label="비밀번호">
              <input id="signup-password" name="password" type="password" autoComplete="new-password" required />
            </FormField>
            <FormField id="signup-role" label="가입 유형">
              <select id="signup-role" value={role} onChange={(event) => setRole(event.target.value === "INSTITUTION_MANAGER" ? "INSTITUTION_MANAGER" : "COMPANY_USER")}>
                <option value="COMPANY_USER">기업</option>
                <option value="INSTITUTION_MANAGER">기관·대학 담당자</option>
              </select>
            </FormField>
            {role === "COMPANY_USER" ? (
              <>
                <FormField id="signup-company" label="회사명">
                  <input id="signup-company" name="companyName" required />
                </FormField>
                <FormField id="signup-business" label="사업자등록번호" hint="숫자 10자리 · 하이픈 입력 가능">
                  <input id="signup-business" name="businessRegNo" inputMode="numeric" required />
                </FormField>
              </>
            ) : (
              <>
                <FormField id="signup-affiliation" label="소속 등록 방식" className="form-field--full">
                  <select id="signup-affiliation" value={existing ? "existing" : "new"} onChange={(event) => setExisting(event.target.value === "existing")}>
                    <option value="existing">등록된 기관·대학 선택</option>
                    <option value="new">미등록 기관·대학 신청</option>
                  </select>
                </FormField>
                {existing ? (
                  <FormField id="signup-institution" label="소속 기관·대학" className="form-field--full"
                    hint={institutions.data?.length === 0 ? "등록된 기관·대학이 없습니다. 소속 등록 방식을 변경할 수 있습니다." : undefined}>
                    <select id="signup-institution" name="organizationId" defaultValue="" required disabled={!institutions.data?.length}>
                      <option value="" disabled>{institutions.loading ? "불러오는 중…" : "기관·대학 선택"}</option>
                      {institutions.data?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.orgType === "UNIVERSITY" ? "대학" : "기관"}{item.region ? ` · ${item.region}` : ""})
                        </option>
                      ))}
                    </select>
                    {institutions.error && <ApiState error={institutions.error} onRetry={institutions.reload} />}
                  </FormField>
                ) : (
                  <>
                    <FormField id="signup-org-type" label="조직 유형">
                      <select id="signup-org-type" name="orgType"><option value="INSTITUTION">기관</option><option value="UNIVERSITY">대학</option></select>
                    </FormField>
                    <FormField id="signup-org-name" label="기관·대학 이름">
                      <input id="signup-org-name" name="organizationName" required />
                    </FormField>
                    <FormField id="signup-org-address" label="소속 조직 주소">
                      <input id="signup-org-address" name="address" required />
                    </FormField>
                    <FormField id="signup-org-phone" label="소속 조직 연락처">
                      <input id="signup-org-phone" name="organizationPhone" type="tel" required />
                    </FormField>
                  </>
                )}
              </>
            )}
          </div>
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
        <div className="form-actions">
          <AuthCardLink className="login-signup-link" to="/auth/login">로그인으로 돌아가기</AuthCardLink>
          <Button type="submit" disabled={!verified || action.busy || (selectInstitution && !institutions.data?.length)}>
            가입 신청
          </Button>
        </div>
      </form>
    </div>
  );
}
