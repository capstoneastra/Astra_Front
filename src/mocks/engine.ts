import { mockDatabase } from "./database";
import { contextFor, MockApiError } from "./http";
import type { ok } from "./http";
import { authenticate, authRoutes } from "./routes/auth";
import { catalogRoutes } from "./routes/catalog";
import { aiRoutes } from "./routes/ai";
import { requestRoutes } from "./routes/requests";
import { simulationRoutes } from "./routes/simulation";
import { dashboardRoutes } from "./routes/dashboard";

const publicPaths = ["/auth/login", "/auth/refresh", "/auth/institutions"];
export type MockRoute = [method: string, path: string, handler: (context: ReturnType<typeof contextFor>) => ReturnType<typeof ok>];
export interface MockApiOptions {
  database?: typeof mockDatabase;
  clock?: () => Date;
}

interface MockRequest {
  method: string;
  url: string;
  body?: object | null;
  authorization?: string | null;
}

const routeDefinitions: MockRoute[] = [
  ...authRoutes,
  ...catalogRoutes,
  ...aiRoutes,
  ...requestRoutes,
  ...simulationRoutes,
  ...dashboardRoutes,
];
const routes = routeDefinitions.map(([method, path, handler]) => {
  const names = [];
  const pattern = path
    .split("/")
    .map((part) => {
      if (!part.startsWith(":")) return part;
      const name = part.slice(1);
      names.push(name);
      return ["id", "no"].includes(name) ? "(\\d+)" : "([^/]+)";
    })
    .join("/");
  return { method, pattern: new RegExp(`^${pattern}$`), names, handler };
});
export function createMockApi({
  database = mockDatabase,
  clock = () => new Date(),
}: MockApiOptions = {}) {
  return {
    execute({ method, url, body = {}, authorization }: MockRequest) {
      try {
        const parsed = new URL(url, "http://astra.mock"),
          path = parsed.pathname.replace(/^\/api\/v1/, "");
        const ctx = contextFor(
          database.read(),
          { method, url: parsed, body: body ?? {}, authorization, path },
          clock,
        );
        if (!publicPaths.includes(path)) authenticate(ctx);
        const route = routes.find(
          (r) => r.method === method && r.pattern.test(path),
        );
        if (!route)
          return {
            status: 404,
            envelope: {
              success: false,
              error: {
                code: "NOT_FOUND",
                message: "설계서 기반 Mock에 연결되지 않은 API입니다.",
                details: null,
              },
            },
          };
        const match = route.pattern.exec(path);
        if (!match) throw new Error("Missing mock route parameters");
        ctx.params = Object.fromEntries(
          route.names.map((name, i) => [
            name,
            decodeURIComponent(match[i + 1]),
          ]),
        );
        const result = route.handler(ctx);
        if (result.status < 400 && (method !== "GET" || ctx.changed))
          database.write(ctx.state);
        return result;
      } catch (error) {
        return {
          status: error instanceof MockApiError ? error.status : 500,
          envelope: {
            success: false,
            error: {
              code: error instanceof MockApiError ? error.code : "MOCK_INTERNAL_ERROR",
              message:
                error instanceof MockApiError
                  ? error.message
                  : "시연 데이터 처리 중 오류가 발생했습니다.",
              details: error instanceof MockApiError ? error.details : null,
            },
          },
        };
      }
    },
  };
}
