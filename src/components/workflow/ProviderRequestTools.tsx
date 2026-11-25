import { useState } from "react";
import { useAction } from "../../hooks/useAction";
import { requestService } from "../../services/requestService";
import { Button, FormField } from "../ui";
import { Feedback } from "./Feedback";
export default function ProviderRequestTools({ request: r }) {
  const action = useAction();
  const [amount, setAmount] = useState<string | null>(null), [note, setNote] = useState("");
  const [result, setResult] = useState({ summary: r.result?.summary ?? "", reportNo: r.result?.reportNo ?? "", reportUrl: r.result?.reportUrl ?? "" });
  const price = amount ?? String(r.estimatedFee?.amount ?? "");
  return <section className="provider-request-tools">
    {["UNDER_REVIEW", "SCHEDULING"].includes(r.status) && <details><summary>예상 이용료 입력·수정</summary><form onSubmit={e => { e.preventDefault(); action.run(signal => requestService.estimatedFee(r.id, r.version, Number(price), note, signal), "예상 이용료를 반영했습니다."); }}><div className="form-grid"><FormField id="request-fee" label="예상 이용료 (원)"><input id="request-fee" type="number" min="0" step="1" required value={price} onChange={e => setAmount(e.target.value)} /></FormField><FormField id="request-fee-note" label="산출 근거·안내"><input id="request-fee-note" value={note} onChange={e => setNote(e.target.value)} /></FormField></div><Button type="submit" disabled={action.busy || price === "" || !Number.isSafeInteger(Number(price)) || Number(price) < 0}>이용료 반영</Button></form></details>}
    {r.status === "CONFIRMED" && <details><summary>시험 결과·성적서 등록</summary><form onSubmit={e => { e.preventDefault(); action.run(signal => requestService.result(r.id, result, signal), "결과를 등록했습니다."); }}><FormField id="result-summary" label="결과 요약"><textarea id="result-summary" required value={result.summary} onChange={e => setResult({ ...result, summary: e.target.value })} /></FormField><div className="form-grid"><FormField id="result-number" label="성적서 번호"><input id="result-number" value={result.reportNo} onChange={e => setResult({ ...result, reportNo: e.target.value })} /></FormField><FormField id="result-url" label="성적서 링크 (선택)"><input id="result-url" type="url" value={result.reportUrl} onChange={e => setResult({ ...result, reportUrl: e.target.value })} /></FormField></div><Button type="submit" disabled={action.busy || !result.summary.trim()}>시험 결과 등록</Button></form></details>}
    <Feedback action={action} />
  </section>;
}
