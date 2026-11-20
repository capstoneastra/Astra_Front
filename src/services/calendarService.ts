import { requestService } from "./requestService";
import { contractError } from "../api/errors";
import { schedulesFromRequests } from "../domain/calendar";
import type { RequestDetail, RequestSummary } from "./contracts";

// No calendar endpoint exists in v3. Only fetch IDs returned by the scoped list.
export async function loadCalendar(signal?: AbortSignal, service = requestService) {
  const listed: RequestSummary[] = [];
  let page = 0, totalPages;
  do {
    signal?.throwIfAborted();
    const response = await service.list({ page, size: 100 }, signal);
    if (!Array.isArray(response?.content) || !Number.isInteger(response.totalPages) || response.totalPages < 0)
      throw contractError("의뢰 목록의 페이지 정보가 명세와 다릅니다.");
    totalPages = response.totalPages;
    listed.push(...response.content);
    page++;
    if (page > 1000) throw contractError("조회 범위가 큽니다. 백엔드의 기간별 예약 조회 지원이 필요합니다.");
  } while (page < totalPages);
  const ids = [...new Set(listed.map((item) => item.id))];
  if (ids.some((id) => id == null)) throw contractError("의뢰 식별자가 없습니다.");
  const requests = new Array<RequestDetail>(ids.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
    while (cursor < ids.length) {
      signal?.throwIfAborted();
      const index = cursor++;
      const detail = await service.get(ids[index], signal);
      if (detail?.id !== ids[index] || !Array.isArray(detail.reservations))
        throw contractError("의뢰 상세의 예약 정보가 없습니다. 백엔드 응답을 확인해주세요.");
      requests[index] = detail;
    }
  }));
  try {
    return { requests, schedules: schedulesFromRequests(requests) };
  } catch {
    throw contractError("예약 상태 또는 일정 응답 형식이 명세와 다릅니다.");
  }
}
