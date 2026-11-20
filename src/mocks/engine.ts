import { mockDatabase } from "./database";
import { contextFor, MockApiError, reject } from "./http";
import type { MockParticipant, ok } from "./http";
import type { User } from "../services/authService";
import { catalogRoutes } from "./routes/catalog";
import { aiRoutes } from "./routes/ai";
import { requestRoutes } from "./routes/requests";
import { simulationRoutes } from "./routes/simulation";
import { dashboardRoutes } from "./routes/dashboard";

export type MockRoute = [method: string, path: string, handler: (context: ReturnType<typeof contextFor>) => ReturnType<typeof ok>];
export interface MockApiOptions {
  database?: typeof mockDatabase;
  clock?: () => Date;
  additionalRoutes?: readonly MockRoute[];
}

interface MockRequest {
  method: string;
  url: string;
  body?: object | null;
  user: User;
}

const routeDefinitions: MockRoute[] = [
  ...catalogRoutes,
  ...aiRoutes,
  ...requestRoutes,
  ...simulationRoutes,
  ...dashboardRoutes,
];
function compileRoute([method, path, handler]: MockRoute) {
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
}
const routes = routeDefinitions.map(compileRoute);
const pathFor = (url: URL) => url.pathname.replace(/^\/api\/v1(?=\/)/, "");

export function createMockApi({
  database = mockDatabase,
  clock = () => new Date(),
  additionalRoutes = [],
}: MockApiOptions = {}) {
  const participants = new Map<number, MockParticipant>();
  const availableRoutes = [...routes, ...additionalRoutes.map(compileRoute)];
  const matchRoute = (method: string, path: string) =>
    availableRoutes.find((route) => route.method === method && route.pattern.test(path));
  return {
    matches(method: string, url: string) {
      return Boolean(matchRoute(method, pathFor(new URL(url))));
    },
    execute({ method, url, body = {}, user }: MockRequest) {
      try {
        const parsed = new URL(url, "http://astra.mock"),
          path = pathFor(parsed);
        if (user.status !== "ACTIVE")
          reject(403, "ACCOUNT_NOT_ACTIVE", "이용할 수 없는 계정입니다.", { status: user.status });
        const organizationId = user.organization?.id ?? null;
        participants.set(user.id, { id: user.id, role: user.role, organizationId });
        const ctx = contextFor(
          database.read(),
          { method, url: parsed, body: body ?? {}, path, user: { ...user, organizationId }, participants },
          clock,
        );
        const route = matchRoute(method, path);
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
