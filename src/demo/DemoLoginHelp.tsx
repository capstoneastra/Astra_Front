import { Building2, FlaskConical, GraduationCap, ShieldCheck } from "lucide-react";
import { quickDemoAccounts, DEMO_PASSWORD } from "./session";
import { apiConfig } from "../api/config";
import "./loginQuickActions.css";

export default function DemoLoginHelp({ onLogin, busy, email }: { onLogin: (email: string, password: string) => Promise<void>; busy: boolean; email: string }) {
  const icons = [Building2, FlaskConical, GraduationCap, ShieldCheck];
  const labels = ["기업", "기관", "대학", "관리자"];
  return <section className="demo-quick-login" aria-label="시연 계정 바로 로그인">
    <div className="demo-quick-login__heading"><strong>시연 계정으로 바로 시작</strong><span>DEMO</span></div>
    <div className="demo-quick-login__accounts">{quickDemoAccounts.map((account, index) => {
      const Icon = icons[index];
      return <button type="button" key={account.email} title={account.email} data-account={account.email} disabled={busy} aria-pressed={email === account.email} onClick={() => { void onLogin(account.email, DEMO_PASSWORD); }}>
        <Icon size={19} aria-hidden="true" /><strong>{labels[index]}</strong>
      </button>;
    })}</div>
    <p>선택하면 계정 입력 후 바로 로그인됩니다. 비밀번호 <code>{DEMO_PASSWORD}</code></p>
    <small>{apiConfig.isPublicDemo ? "공개 DEMO · 실제 서버 인증 없이 예시 데이터로 동작합니다." : "서버 없이 동작하는 개발 시연용 로그인입니다."}</small>
  </section>;
}
