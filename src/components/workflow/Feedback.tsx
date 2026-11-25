import { Info } from "lucide-react";
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
/** 화면 상단의 짧은 주의 문구. 내용이 없으면 아무것도 표시하지 않습니다. */
export function PageNotice({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="page-hint">
      <Info size={14} aria-hidden="true" />
      {children}
    </p>
  );
}
