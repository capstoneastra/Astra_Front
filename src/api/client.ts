import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { apiConfig } from "./config";
import { ApiError, errorFromEnvelope, validateEnvelope } from "./errors";
import { tokenStore } from "../auth/tokenStore";

declare module "axios" {
  // Axios propagates custom request fields through its interceptors.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface AxiosRequestConfig<D, P> {
    authToken?: string | null;
    requiresAuth?: boolean;
    sessionVersion?: number;
  }
}

interface ApiClientOptions {
  baseURL?: string;
  store?: typeof tokenStore;
  adapter?: AxiosRequestConfig["adapter"];
}

export function createApiClient({
  baseURL = apiConfig.baseURL,
  store = tokenStore,
  adapter,
}: ApiClientOptions = {}) {
  const client = axios.create({
    baseURL,
    timeout: 15000,
    withCredentials: false,
    headers: { Accept: "application/json" },
    ...(adapter ? { adapter } : {}),
  });
  client.interceptors.request.use((config) => {
    config.sessionVersion ??= store.getVersion();
    const accessToken = config.authToken ?? store.getToken();
    if (config.requiresAuth !== false && accessToken)
      config.headers.set("Authorization", `Bearer ${accessToken}`);
    else config.headers.delete("Authorization");
    return config;
  });
  client.interceptors.response.use(
    (response) => {
      validateEnvelope(response.data, response.status);
      return response;
    },
    (failure) => {
      if (axios.isCancel(failure))
        return Promise.reject(
          new ApiError("요청이 취소되었습니다.", { code: "ABORTED" }),
        );
      const status = failure.response?.status ?? 0;
      const inactive =
        status === 403 &&
        failure.response?.data?.error?.code === "ACCOUNT_NOT_ACTIVE";
      if (
        (status === 401 || inactive) &&
        failure.config?.requiresAuth !== false &&
        failure.config?.sessionVersion === store.getVersion()
      )
        store.clear(
          inactive
            ? {
                type: "account_inactive",
                error: errorFromEnvelope(failure.response?.data, status),
              }
            : "expired",
        );
      const error = status
        ? errorFromEnvelope(failure.response?.data, status)
        : new ApiError(
            failure.code === "ECONNABORTED"
              ? "서버 응답 시간이 초과되었습니다. 다시 시도해주세요."
              : "서버에 연결할 수 없습니다. 백엔드 주소와 실행 상태를 확인해주세요.",
            {
              code:
                failure.code === "ECONNABORTED" ? "TIMEOUT" : "NETWORK_ERROR",
            },
          );
      return Promise.reject(error);
    },
  );
  return client;
}

export const apiClient = createApiClient();
export function responseData<T = unknown>(response: AxiosResponse<unknown>) {
  return validateEnvelope<T>(response.data, response.status);
}
