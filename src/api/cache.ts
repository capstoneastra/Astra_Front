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

export function invalidateData() {
  const queryKey = apiQueryScope();
  // Restart initial reads as well, so a write cannot leave an older result cached.
  void queryClient.cancelQueries({ queryKey }).then(() =>
    queryClient.invalidateQueries({ queryKey }),
  );
}
