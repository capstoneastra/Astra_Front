import { MOCK_PASSWORD, mockAccounts, mockDatabase } from "./database";
import { tokenStore } from "../auth/tokenStore";
import { Badge, Button } from "../components/ui/index";
export default function MockAccountPanel({ onSelect, disabled }) {
  return (
    <div className="content-note">
      <div>
        <Badge tone="amber">DEMO · 개발 전용 Mock 로그인</Badge>
        <p>
          실제 서비스 계정이 아닙니다. 공통 시연 비밀번호:{" "}
          <strong>{MOCK_PASSWORD}</strong>
        </p>
        <div className="form-actions">
          {mockAccounts.map((account) => (
            <Button
              key={account.id}
              variant="secondary"
              disabled={disabled}
              onClick={() => onSelect(account.email, MOCK_PASSWORD)}
              title={account.email}
            >
              {account.label}
            </Button>
          ))}
        </div>
        <p className="field-hint">
          기업: company@astra.demo · 기관: manager1@astra.demo · 관리자:
          admin@astra.demo. 유형 버튼은 입력만 채우며 실제 역할은 Mock API의
          계정 정보로 확인합니다.
        </p>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            if (
              window.confirm(
                "이 브라우저의 시연 의뢰·상담·승인 상태를 초기화할까요? 실제 서버 데이터에는 영향이 없습니다.",
              )
            ) {
              mockDatabase.reset();
              tokenStore.clear();
              window.location.reload();
            }
          }}
        >
          시연 데이터 초기화
        </Button>
      </div>
    </div>
  );
}
