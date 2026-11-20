import { http, HttpResponse, delay } from "msw";
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
  return [
    http.all(`${baseURL.replace(/\/$/, "")}/*`, async ({ request }) => {
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
        authorization: request.headers.get("authorization"),
      });
      return HttpResponse.json(result.envelope, { status: result.status });
    }),
  ];
}
