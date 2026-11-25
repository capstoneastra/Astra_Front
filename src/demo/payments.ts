import { mockDatabase } from "./database";
import { ApiError } from "../api/errors";
import type { User } from "../services/authService";
function requestFor(id: number, user: User) {
  const state = mockDatabase.read(), request = state.requests.find(r => r.id === id);
  if (!request) throw new ApiError("의뢰가 없습니다.", { status: 404 });
  if (request.ownerId !== user.id && user.role !== "ADMIN") throw new ApiError("본인의 의뢰만 결제할 수 있습니다.", { status: 403 });
  return { state, request };
}
const quoteKey = r => JSON.stringify([r.id, r.estimatedFee?.amount, r.estimatedFee?.updatedAt, r.revisions.at(-1).revisionNo]);
export function readPayment(id: number, user: User) {
  const { state, request } = requestFor(id, user);
  return state.payments?.find(p => p.quoteKey === quoteKey(request)) ?? null;
}
export function approveDemoPayment(id: number, user: User, displayedAmount: number, simulateFailure = false) {
  const { state, request } = requestFor(id, user);
  if (request.ownerId !== user.id) throw new ApiError("의뢰자만 시연 결제를 승인할 수 있습니다.", { status: 403 });
  if (!["SCHEDULING", "CONFIRMED", "COMPLETED"].includes(request.status)) throw new ApiError("기관 검토 후에 결제할 수 있습니다.", { status: 409 });
  const amount = request.estimatedFee?.amount;
  if (!Number.isSafeInteger(amount) || amount < 0 || amount !== displayedAmount) throw new ApiError("이용료가 변경됐거나 등록되지 않았습니다. 새로 확인해주세요.", { status: 409 });
  const existing = state.payments?.find(p => p.quoteKey === quoteKey(request));
  if (existing) return existing;
  if (simulateFailure) throw new ApiError("DEMO 결제 실패 시연입니다. 실제 청구는 없습니다.", { code: "DEMO_PAYMENT_FAILED" });
  const receipt = { id: `DEMO-PAY-${++state.sequence}`, requestId: id, quoteKey: quoteKey(request), amount, status: "APPROVED_DEMO", approvedAt: new Date().toISOString() };
  state.payments = [...(state.payments ?? []), receipt]; mockDatabase.write(state);
  return receipt;
}
