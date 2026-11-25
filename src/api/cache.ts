import { QueryClient } from "@tanstack/react-query";
import { tokenStore } from "../auth/tokenStore";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      networkMode: "always",
    },
  },
});

const apiQueryScope = () => ["api", tokenStore.getVersion()] as const;
export const apiQueryKey = (key: string) => [...apiQueryScope(), key] as const;

/**
 * 잘 바뀌지 않는 기준 데이터 — 장비 전체 목록(catalog, 페이지 여러 번 요청), 시험유형, 사양 사전.
 * 장비를 고치는 쓰기에서만 다시 불러오고, 그 밖의 쓰기(채팅·알림·승인 등)에서는 건드리지 않는다.
 */
const isReferenceKey = (key: unknown) =>
  typeof key === "string" &&
  (key.startsWith("catalog:") || key === "test-types" || key === "calendar-test-types" || key === "spec-definitions");

/** 화면에 다시 들어올 때 이 시간 안이면 다시 요청하지 않는다 (ms). 그 밖의 데이터는 기존대로 매번 새로 받음 */
export function staleTimeFor(key: string) {
  if (isReferenceKey(key)) return 5 * 60_000;
  if (key.startsWith("calendar:")) return 30_000;
  return 0;
}

/** @param path 방금 쓴 API 경로. 장비(/equipment…)를 바꾼 경우에만 기준 데이터까지 다시 불러온다 */
export function invalidateData(path?: string) {
  const queryKey = apiQueryScope();
  const touchesReference = !path || path.startsWith("/equipment") || path.startsWith("/test-types");
  const predicate = touchesReference ? undefined : (query: { queryKey: readonly unknown[] }) => !isReferenceKey(query.queryKey[2]);
  // Restart initial reads as well, so a write cannot leave an older result cached.
  void queryClient.cancelQueries({ queryKey, predicate }).then(() =>
    queryClient.invalidateQueries({ queryKey, predicate }),
  );
}
