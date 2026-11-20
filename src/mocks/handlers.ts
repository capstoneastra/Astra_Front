import { bypass, delay, http, HttpResponse, passthrough } from "msw";
import { validateEnvelope } from "../api/errors";
import { validateUser } from "../services/authService";
import type { User } from "../services/authService";
import { createMockApi } from "./engine";
import type { MockApiOptions } from "./engine";

interface MockHandlerOptions extends MockApiOptions {
  baseURL?: string;
  latency?: number;
}

export function createHandlers({
  database,
  clock,
  baseURL = "http://astra.mock/api/v1",
  latency = 160,
}: MockHandlerOptions = {}) {
  const api = createMockApi({ database, clock });
  const backend = baseURL.replace(/\/$/, "");
  return [
    http.all(`${backend}/*`, async ({ request }) => {
      if (!api.matches(request.method, request.url)) return passthrough();
      const authorization = request.headers.get("authorization");
      if (!authorization) return passthrough();
      let profile: Response;
      try {
        profile = await fetch(bypass(`${backend}/users/me`, {
          headers: { Authorization: authorization },
          credentials: "omit",
          signal: request.signal,
        }));
      } catch {
        return HttpResponse.error();
      }
      if (!profile.ok) return profile;

      let user: User;
      try {
        user = validateUser(validateEnvelope<User>(await profile.json()));
      } catch {
        return HttpResponse.json({
          success: false,
          error: { code: "INVALID_RESPONSE", message: "백엔드 사용자 응답이 명세와 다릅니다.", details: null },
        }, { status: 400 });
      }
      if (user.role === "ADMIN" && new URL(request.url).pathname === "/api/v1/dashboard/summary")
        return passthrough();
      if (latency) await delay(latency);
      let body = {};
      if (!["GET", "HEAD"].includes(request.method)) {
        const raw = await request.text();
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: "VALIDATION_FAILED",
                message: "JSON 요청 형식이 올바르지 않습니다.",
                details: null,
              },
            },
            { status: 400 },
          );
        }
      }
      const result = api.execute({
        method: request.method,
        url: request.url,
        body,
        user,
      });
      return HttpResponse.json(result.envelope, { status: result.status });
    }),
  ];
}
