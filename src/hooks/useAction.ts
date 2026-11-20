import { useCallback, useEffect, useRef, useState } from "react";
import { toApiError } from "../api/errors";
import type { ApiError } from "../api/errors";

interface ActionState {
  busy: boolean;
  error: ApiError | null;
  message: string;
}

export function useAction() {
  const [state, setState] = useState<ActionState>({ busy: false, error: null, message: "" });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const clearFeedback = useCallback(() => {
    setState((previous) => ({ ...previous, error: null, message: "" }));
  }, []);
  const run = useCallback(async <T>(task: (signal: AbortSignal) => T | Promise<T>, message = "") => {
    if (controller.current && !controller.current.signal.aborted) return;
    const current = new AbortController();
    controller.current = current;
    setState({ busy: true, error: null, message: "" });
    try {
      const value = await task(current.signal);
      if (!current.signal.aborted)
        setState({ busy: false, error: null, message });
      return value;
    } catch (failure) {
      const error = toApiError(failure);
      if (!current.signal.aborted && error.code !== "ABORTED")
        setState({ busy: false, error, message: "" });
    } finally {
      if (controller.current === current) controller.current = null;
    }
  }, []);
  return { ...state, run, clearFeedback };
}
