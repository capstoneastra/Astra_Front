import { useCallback } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiQueryKey, staleTimeFor } from "../api/cache";
import { toApiError } from "../api/errors";

export function useApiQuery<T>(
  task: (signal: AbortSignal) => T | Promise<T>,
  key: string,
  enabled = true,
  poll?: (data: T) => number | false,
  /** true 면 조건이 바뀌어 새로 불러오는 동안 이전 결과를 그대로 보여 줌 (검색 목록이 깜빡이지 않게) */
  keepPrevious = false,
) {
  const query = useQuery({
    queryKey: apiQueryKey(key),
    queryFn: async ({ signal }) => {
      try {
        return (await task(signal)) ?? null;
      } catch (failure) {
        throw toApiError(failure);
      }
    },
    enabled,
    staleTime: staleTimeFor(key),
    ...(keepPrevious ? { placeholderData: keepPreviousData } : {}),
    refetchInterval: (query) =>
      query.state.status === "success" && poll ? poll(query.state.data) : false,
    refetchIntervalInBackground: Boolean(poll),
  });
  const { refetch } = query;
  const reload = useCallback(() => {
    if (enabled) void refetch();
  }, [enabled, refetch]);
  const waiting = enabled && (query.isFetching || query.isPending);
  const error = enabled && !waiting ? query.error : null;
  const data = enabled && !error ? (query.data ?? null) : null;
  let status: "idle" | "loading" | "ready" | "error" = "idle";
  if (enabled) status = waiting ? "loading" : error ? "error" : "ready";

  return {
    status,
    data,
    error,
    loading: waiting && data === null,
    refreshing: waiting && data !== null,
    reload,
  };
}
