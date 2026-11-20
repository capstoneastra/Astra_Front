import { Info } from "lucide-react";
import { apiConfig } from "../../api/config";
import ApiState from "../ui/ApiState";
import type { ApiStateProps } from "../ui/ApiState";
import type { ReactNode } from "react";

export function Feedback({ action, onRetry }: {
  action: { error: ApiStateProps["error"]; message: string };
  onRetry?: ApiStateProps["onRetry"];
}) {
  return (
    <>
      {action.error && <ApiState error={action.error} onRetry={onRetry} />}{" "}
      {action.message && (
        <p className="content-note" role="status">
          {action.message}
        </p>
      )}
    </>
  );
}
export function DemoNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="content-note">
      <Info size={16} />
      <span>
        {apiConfig.isMock
          ? "DEMO · MSW 시연 데이터입니다. 실제 기관으로 전송되지 않습니다."
          : "실제 API 모드 · 최종 시험 가능 여부와 일정은 기관이 확인합니다."}
        {children && (
          <>
            <br />
            {children}
          </>
        )}
      </span>
    </div>
  );
}
