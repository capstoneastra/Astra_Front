import { setupWorker } from "msw/browser";
import { apiConfig } from "../api/config";
import { createHandlers } from "./handlers";

const baseURL = new URL(apiConfig.baseURL, window.location.origin);
if (baseURL.origin !== window.location.origin || baseURL.pathname !== "/api/v1")
  throw new Error("Mock 모드는 같은 출처의 /api/v1 경로에서만 실행합니다.");
export const worker = setupWorker(...createHandlers({ baseURL: baseURL.href }));
