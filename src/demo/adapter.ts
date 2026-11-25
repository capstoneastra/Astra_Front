import { AxiosError } from "axios";
import { apiClient } from "../api/client";
import { createMockApi } from "./engine";
import { createPreviewAdminRoutes } from "./adminRoutes";
import type { PreviewAccount } from "../preview/paths";
import { previewUsers } from "../preview/user";
import { apiConfig } from "../api/config";
import { demoRuntimeEnabled } from "../api/demoMode";
import { ApiError } from "../api/errors";
import { readDemoUser } from "./session";

export function initializeDemoApi(account?: PreviewAccount) {
  if (!demoRuntimeEnabled || !apiConfig.isMock)
    throw new Error("DEMO는 명시적으로 활성화한 시연 환경에서만 사용할 수 있습니다.");
  const api = createMockApi({
    additionalRoutes: createPreviewAdminRoutes(),
  });
  apiClient.defaults.adapter = async (config) => {
    config.headers.delete("Authorization");
    const user = account ? previewUsers[account] : readDemoUser();
    if (!user) throw new ApiError("DEMO 로그인이 필요합니다.", { status: 401, code: "AUTH_REQUIRED" });
    if (config.signal?.aborted) throw new ApiError("요청이 취소되었습니다.", { code: "ABORTED" });
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); config.signal?.removeEventListener?.("abort", cancel); reject(new ApiError("요청이 취소되었습니다.", { code: "ABORTED" })); };
      const timer = setTimeout(() => { config.signal?.removeEventListener?.("abort", cancel); resolve(); }, 180);
      config.signal?.addEventListener?.("abort", cancel, { once: true });
    });
    const result = api.execute({
      method: config.method?.toUpperCase() ?? "GET",
      url: apiClient.getUri(config),
      body: config.data ? JSON.parse(config.data) : {},
      user,
    });
    const response = {
      data: result.envelope,
      status: result.status,
      statusText: String(result.status),
      headers: { "x-astra-source": "DEMO" },
      config,
    };
    if (result.status >= 400)
      throw new AxiosError("미리보기 요청을 처리할 수 없습니다.", undefined, config, undefined, response);
    return response;
  };
}
