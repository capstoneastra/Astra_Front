import { setupWorker } from "msw/browser";
import { apiConfig } from "../api/config";
import { createHandlers } from "./handlers";

const baseURL = new URL(apiConfig.baseURL, window.location.origin);
if (baseURL.pathname !== "/api/v1")
  throw new Error("Mock 모드의 백엔드 주소는 /api/v1로 끝나야 합니다.");
export const worker = setupWorker(...createHandlers({ baseURL: baseURL.href }));
