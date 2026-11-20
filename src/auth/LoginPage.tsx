import { useState } from "react";
import type { FormEvent } from "react";
import { LockKeyhole, Orbit } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useAuth } from "./context";
import { Button, FormField, PageHeader, Panel } from "../components/ui";
import ThemeToggle from "../components/ui/ThemeToggle";
import InternalPreviewLinks from "./InternalPreviewLinks";

export default function LoginPage() {
  const { login, error } = useAuth();
  const signupPending = useLocation().state?.signupPending === true;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      setValidation("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setValidation("");
    setBusy(true);
    try {
      await login(email.trim(), password);
    } finally {
      setBusy(false);
      setPassword("");
    }
  };
  const account = error?.code === "ACCOUNT_NOT_ACTIVE" ? error.details : null;
  const statusText: Record<string, string> = {
    PENDING: "관리자 승인 대기 중입니다.",
    REJECTED: "가입이 반려되었습니다.",
    SUSPENDED: "이용이 정지된 계정입니다.",
  };
  return (
    <main className="main-content">
      <div className="content-page content-page--narrow page-enter">
        <PageHeader
          eyebrow="ASTRA · MEMBER WORKSPACE"
          title="ASTRA 로그인"
          description="인증된 회원만 우주항공 시험장비 공동활용 서비스를 이용할 수 있습니다."
        >
          <ThemeToggle />
        </PageHeader>
        <Panel className="form-panel">
          <div className="form-section-heading">
            <span>
              <Orbit size={20} />
            </span>
            <div>
              <h2>회원 로그인</h2>
              <p>기업·기관 담당자·관리자 권한은 서버에서 확인합니다.</p>
            </div>
          </div>
          {signupPending && (
            <div className="content-note" role="status">
              가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.
            </div>
          )}
          <form onSubmit={submit} aria-busy={busy}>
            <div className="form-grid">
              <FormField
                id="login-email"
                label="이메일"
                className="form-field--full"
              >
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </FormField>
              <FormField
                id="login-password"
                label="비밀번호"
                className="form-field--full"
              >
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </FormField>
            </div>
            {(error || validation) && (
              <div className="content-note" role="alert">
                <LockKeyhole size={16} />
                <span>
                  {validation || (account ? statusText[account.status] ?? error?.message : error?.message)}
                  {account?.rejectReason && (
                    <>
                      <br />
                      {account.rejectReason}
                    </>
                  )}
                </span>
              </div>
            )}
            <div className="form-actions">
              <Link className="text-link" to="/auth/signup">회원가입</Link>
              <Button type="submit" icon={LockKeyhole} disabled={busy}>
                {busy ? "로그인 확인 중…" : "로그인"}
              </Button>
            </div>
          </form>
          <InternalPreviewLinks />
        </Panel>
      </div>
    </main>
  );
}
