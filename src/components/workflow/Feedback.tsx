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
  if (!apiConfig.isMock && !children) return null;
  return (
    <div className="data-source-note">
      <Info size={16} />
      <span>
        {apiConfig.isMock && "DEMO · 시연 데이터입니다. "}
        {children}
      </span>
    </div>
  );
}
