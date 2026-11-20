import { useCallback, useEffect, useRef, useState } from "react";
import { DATA_CHANGED } from "../api/cache";
import { toApiError } from "../api/errors";
import type { ApiError } from "../api/errors";

interface QueryState<T> {
  key: string | null;
  status: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error: ApiError | null;
}

export function useApiQuery<T>(task: (signal: AbortSignal) => T | Promise<T>, key: string, enabled = true) {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  });
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<QueryState<T>>({
    key: null,
    status: "idle",
    data: null,
    error: null,
  });
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener(DATA_CHANGED, reload);
    return () => window.removeEventListener(DATA_CHANGED, reload);
  }, [reload]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          key,
          status: "loading",
          data: previous.key === key ? previous.data : null,
          error: null,
        }));
        return taskRef.current(controller.signal);
      })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ key, status: "ready", data: data ?? null, error: null });
      })
      .catch((failure: unknown) => {
        const error = toApiError(failure);
        if (!controller.signal.aborted && error.code !== "ABORTED")
          setState({ key, status: "error", data: null, error });
      });
    return () => controller.abort();
  }, [key, enabled, revision]);
  const current: Omit<QueryState<T>, "key"> & { key?: string } = !enabled
    ? { status: "idle", data: null, error: null }
    : state.key === key
      ? state
      : { status: "loading", data: null, error: null };
  return {
    ...current,
    loading:
      enabled &&
      ["idle", "loading"].includes(current.status) &&
      current.data === null,
    refreshing: current.status === "loading" && current.data !== null,
    reload,
  };
}
