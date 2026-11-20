import { lazy, Suspense, useState } from "react";
import { LockKeyhole, Orbit } from "lucide-react";
import { useAuth } from "./context";
import { Button, FormField, PageHeader, Panel } from "../components/ui";
import { apiConfig } from "../api/config";
import ThemeToggle from "../components/ui/ThemeToggle";
const MockAccountPanel = import.meta.env.DEV
  ? lazy(() => import("../mocks/MockAccountPanel"))
  : null;

export default function LoginPage() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState("");
  const submit = async (event) => {
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
  const statusText = {
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
          {apiConfig.isMock && MockAccountPanel && (
            <Suspense fallback={null}>
              <MockAccountPanel
                disabled={busy}
                onSelect={(nextEmail, nextPassword) => {
                  setEmail(nextEmail);
                  setPassword(nextPassword);
                  setValidation("");
                }}
              />
            </Suspense>
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
                  {validation || error.message}
                  {account && (
                    <>
                      <br />
                      {statusText[account.status] ??
                        "계정 상태를 확인해주세요."}
                      {account.rejectReason && (
                        <>
                          <br />
                          {account.rejectReason}
                        </>
                      )}
                    </>
                  )}
                </span>
              </div>
            )}
            <div className="form-actions">
              <p>
                {apiConfig.isMock
                  ? "위 시연 계정을 선택한 뒤 로그인하세요. 승인 대기 계정은 관리자 화면에서 승인할 수 있습니다."
                  : "이메일 인증·회원가입·계정 승인은 백엔드 담당자에게 문의해주세요."}
              </p>
              <Button type="submit" icon={LockKeyhole} disabled={busy}>
                {busy ? "로그인 확인 중…" : "로그인"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </main>
  );
}
