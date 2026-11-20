import { AxiosError } from "axios";
import { apiClient } from "../api/client";
import { createMockApi } from "../mocks/engine";
import { createPreviewAdminRoutes } from "./adminRoutes";
import type { PreviewAccount } from "./paths";
import { previewUsers } from "./user";

export function initializePreviewApi(account: PreviewAccount) {
  const user = previewUsers[account];
  const api = createMockApi({
    additionalRoutes: user.role === "ADMIN" ? createPreviewAdminRoutes() : [],
  });
  apiClient.defaults.adapter = async (config) => {
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
      headers: {},
      config,
    };
    if (result.status >= 400)
      throw new AxiosError("미리보기 요청을 처리할 수 없습니다.", undefined, config, undefined, response);
    return response;
  };
}
