import { useState } from "react";
import { CreditCard, Check } from "lucide-react";
import { useAuth } from "../../auth/context";
import { apiConfig } from "../../api/config";
import { demoRuntimeEnabled } from "../../api/demoMode";
import { useApiQuery } from "../../hooks/useApiQuery";
import { useAction } from "../../hooks/useAction";
import { paymentService } from "../../services/paymentService";
import { Badge, Button } from "../ui";
import { Feedback } from "./Feedback";
import ApiState from "../ui/ApiState";
export default function RequestPayment({ request: r }) {
  const { user } = useAuth(), action = useAction();
  const [open, setOpen] = useState(false), [approved, setApproved] = useState(false), [receipt, setReceipt] = useState(null);
  const demo = demoRuntimeEnabled && apiConfig.isMock;
  const query = useApiQuery(signal => { signal.throwIfAborted(); return paymentService.read(r.id, user); }, `payment:${user.id}:${r.id}:${r.estimatedFee?.amount}:${r.estimatedFee?.updatedAt}:${r.revision.revisionNo}`, demo);
  const paid = receipt ?? query.data, amount = r.estimatedFee?.amount;
  const allowed = ["SCHEDULING", "CONFIRMED", "COMPLETED"].includes(r.status) && Number.isSafeInteger(amount) && amount >= 0;
  return <section className="request-payment"><header><CreditCard size={18} /><h3>최종 서류 확인·결제</h3><Badge tone="amber">{demo ? "DEMO" : "연결 대기"}</Badge></header>
    {!demo ? <p>PG·결제 API 연결 후 사이트 안에서 결제할 수 있습니다.</p> : query.error ? <ApiState error={query.error} onRetry={query.reload} /> : paid ? <div className="payment-receipt"><Check size={18} /><strong>DEMO 승인 완료 · {paid.amount.toLocaleString("ko-KR")}원</strong><p>{paid.id} · 실제 결제·세금계산서가 아닙니다.</p></div> : !allowed ? <p>기관 검토와 예상 이용료 등록 후 결제할 수 있습니다.</p> : <>
      <Button variant="secondary" disabled={query.loading} onClick={() => { setOpen(!open); setApproved(false); }}>최종 서류 확인·DEMO 결제</Button>
      {open && <div className="payment-checkout"><dl><div><dt>의뢰번호</dt><dd>{r.requestNo}</dd></div><div><dt>신청 조직</dt><dd>{r.revision.content.applicant.companyName}</dd></div><div><dt>수행 조직</dt><dd>{r.institution?.name}</dd></div><div><dt>시연 금액</dt><dd><strong>{amount.toLocaleString("ko-KR")}원</strong></dd></div></dl><p>DEMO 카드 승인 · 실제 카드정보 입력이나 청구 없음</p><label><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} disabled={action.busy} />의뢰 내용과 이용료를 확인했습니다.</label><div className="form-actions"><Button disabled={!approved || action.busy} onClick={() => action.run(async () => setReceipt(await paymentService.approve(r.id, user, amount)))}>DEMO 결제 승인</Button><Button variant="ghost" disabled={!approved || action.busy} onClick={() => action.run(() => paymentService.approve(r.id, user, amount, true))}>실패 시연</Button><Button variant="ghost" onClick={() => setOpen(false)}>닫기</Button></div></div>}
    </>}
    <Feedback action={action} />
  </section>;
}
