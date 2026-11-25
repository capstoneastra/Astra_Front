import { apiClient, responseData } from "../api/client";
import { invalidateData } from "../api/cache";
import type { Method } from "axios";

export const getData = async <T = unknown>(path: string, params?: object, signal?: AbortSignal) =>
  responseData<T>(await apiClient.get(path, { params, signal }));
export const postData = async <T = unknown>(path: string, data: unknown, signal?: AbortSignal) =>
  responseData<T>(await apiClient.post(path, data, { signal }));
export async function mutate<T = unknown>(method: Method, path: string, data: unknown, signal?: AbortSignal) {
  const result = responseData<T>(
    await apiClient.request({ method, url: path, data, signal }),
  );
  invalidateData(path);
  return result;
}
