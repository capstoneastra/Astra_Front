export interface ApiErrorDetails {
  status?: string;
  rejectReason?: string | null;
}

interface ApiErrorOptions {
  status?: number;
  code?: string;
  details?: ApiErrorDetails | null;
}

interface ErrorEnvelope {
  error?: { code?: unknown; message?: unknown; details?: ApiErrorDetails };
}

interface ResponseEnvelope<T> extends ErrorEnvelope {
  success: boolean;
  data?: T;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetails | null;

  constructor(
    message: string,
    { status = 0, code = "UNKNOWN_ERROR", details = null }: ApiErrorOptions = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const messages: Record<string, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다.",
  TOKEN_EXPIRED: "로그인이 만료되었습니다. 다시 로그인해주세요.",
  INVALID_CREDENTIALS: "이메일 또는 비밀번호를 확인해주세요.",
  ACCOUNT_NOT_ACTIVE: "아직 이용할 수 없는 계정입니다.",
  FORBIDDEN: "이 기능에 접근할 권한이 없습니다.",
  EQUIPMENT_NOT_FOUND: "장비가 없거나 비활성화되었습니다.",
  NOT_FOUND: "요청한 정보를 찾을 수 없습니다.",
  INTERNAL_ERROR: "서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  RESERVATION_OVERLAP: "이미 확정된 예약과 시간이 겹칩니다. 최신 일정을 확인한 뒤 다른 시간을 선택해주세요.",
};

export function errorFromEnvelope(body: ErrorEnvelope | null | undefined, status: number) {
  const item = body?.error;
  const code = typeof item?.code === "string" ? item.code : `HTTP_${status}`;
  const fallback =
    status === 403
      ? messages.FORBIDDEN
      : status === 404
        ? messages.NOT_FOUND
        : status === 409
          ? "요청이 현재 서버 상태와 충돌합니다. 정보를 새로 확인해주세요."
          : status >= 500
            ? messages.INTERNAL_ERROR
            : "요청을 처리할 수 없습니다.";
  const message =
    status >= 500
      ? fallback
      : (messages[code] ??
        (typeof item?.message === "string" ? item.message : fallback));
  // Do not retain Axios config, request bodies or response objects containing tokens.
  return new ApiError(message, {
    status,
    code,
    details:
      code === "ACCOUNT_NOT_ACTIVE"
        ? {
            status: item?.details?.status,
            rejectReason: item?.details?.rejectReason,
          }
        : null,
  });
}

export function validateEnvelope<T>(body: unknown, status = 200) {
  if (!body || typeof body !== "object" || !("success" in body) || typeof body.success !== "boolean") {
    throw new ApiError("API 응답 형식이 명세와 다릅니다.", {
      status,
      code: "INVALID_RESPONSE",
    });
  }
  const envelope = body as ResponseEnvelope<T>;
  if (!envelope.success) throw errorFromEnvelope(envelope, status);
  // ApiResponse uses NON_NULL: successful void responses can omit data entirely.
  // Resource services validate their own non-null DTOs.
  return envelope.data;
}

export function contractError(message: string) {
  return new ApiError(message, { code: "INVALID_RESPONSE" });
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(error instanceof Error ? error.message : "요청을 처리할 수 없습니다.");
}
