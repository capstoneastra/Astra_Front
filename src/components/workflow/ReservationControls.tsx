import { useEffect, useState } from "react";
import { useAction } from "../../hooks/useAction";
import { useApiQuery } from "../../hooks/useApiQuery";
import { requestService } from "../../services/requestService";
import { Badge, Button, FormField } from "../ui/index";
import { Feedback } from "./Feedback";
import ApiState from "../ui/ApiState";
import { formatDate } from "../../domain/constants";
import { invalidateData } from "../../api/cache";
import { overlaps } from "../../domain/calendar";

const reservationStatus = {
  PROPOSED: { label: "제안", tone: "cyan" },
  COUNTER_PROPOSED: { label: "대안 제안", tone: "violet" },
  CONFIRMED: { label: "확정", tone: "green" },
  CANCELED: { label: "취소", tone: "neutral" },
};

export default function ReservationControls({ request, initialDate, canConfirm }) {
  const [startAt, setStart] = useState(initialDate ? `${initialDate}T09:00` : ""),
    [endAt, setEnd] = useState(initialDate ? `${initialDate}T18:00` : ""),
    [note, setNote] = useState(""),
    action = useAction();
  const busy = useApiQuery(
    (signal) => requestService.availability(request.equipment.id, {}, signal),
    `availability:${request.equipment.id}`,
  );
  const scheduling = request.status === "SCHEDULING";
  useEffect(() => {
    // A concurrent confirmation/version change must invalidate both the request and busy intervals.
    if (action.error?.status === 409) invalidateData();
  }, [action.error]);
  const availabilityBlocked = busy.loading || busy.refreshing || Boolean(busy.error);
  const start = Date.parse(startAt ? `${startAt}+09:00` : ""),
    end = Date.parse(endAt ? `${endAt}+09:00` : ""),
    valid = Number.isFinite(start) && Number.isFinite(end) && start < end;
  const overlap =
    valid &&
    busy.data?.some(
      (r) => start < Date.parse(r.endAt) && end > Date.parse(r.startAt),
    );
  const body = () => ({
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
    note,
  });
  return (
    <section className="reservation-controls">
      <h3>예약 일정 협의</h3>
      <p className="field-hint">
        한국 시간 기준 · 장비 보유 기관에서 최종 확정
      </p>
      {(busy.loading || busy.error) && (
        <ApiState
          loading={busy.loading}
          error={busy.error}
          onRetry={busy.reload}
        />
      )}
      {busy.data?.length > 0 && (
        <details className="reservation-controls__availability">
          <summary>장비의 확정 일정 ({busy.data.length}건)</summary>
          <ul>
            {busy.data.map((r, i) => (
              <li key={i}>
                {formatDate(r.startAt)} ~ {formatDate(r.endAt)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {scheduling && (
        <div className="reservation-controls__proposal">
          <div className="reservation-controls__fields">
            <FormField id="reservation-start" label="시작 시간">
              <input
                id="reservation-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStart(e.target.value)}
                disabled={action.busy}
              />
            </FormField>
            <FormField id="reservation-end" label="종료 시간">
              <input
                id="reservation-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEnd(e.target.value)}
                disabled={action.busy}
              />
            </FormField>
            <FormField
              id="reservation-note"
              label="일정 협의 메모"
              className="form-field--full"
            >
              <input
                id="reservation-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </FormField>
          </div>
          {overlap && (
            <p className="content-note" role="alert">
              이미 확정된 예약과 겹칩니다. 다른 시간대를 선택해주세요.
            </p>
          )}
          {startAt && endAt && !valid && (
            <p role="alert">종료 시간은 시작 시간보다 뒤여야 합니다.</p>
          )}
          <div className="form-actions">
            <Button
              disabled={
                !valid ||
                overlap ||
                availabilityBlocked ||
                action.busy
              }
              onClick={() =>
                action.run(
                  (signal) =>
                    requestService.propose(request.id, request.version, body(), signal),
                  "일정을 제안했습니다. 아직 확정되지 않았습니다.",
                )
              }
            >
              일정 제안
            </Button>
          </div>
        </div>
      )}
      {request.reservations.length > 0 && (
        <ul className="reservation-controls__list" aria-label="의뢰의 예약 일정">
          {request.reservations.map((r) => {
            const conflicting = busy.data?.some((interval) => overlaps(r, interval));
            const canRespond = scheduling && ["PROPOSED", "COUNTER_PROPOSED"].includes(r.status);
            const canCancel = r.status !== "CANCELED" && request.status !== "COMPLETED";
            const status = reservationStatus[r.status];
            return (
              <li className="reservation-controls__item" key={r.id}>
                <div className="reservation-controls__item-heading">
                  <strong>
                    {formatDate(r.startAt)} ~ {formatDate(r.endAt)}
                  </strong>
                  <Badge tone={status?.tone}>{status?.label ?? r.status}</Badge>
                </div>
                {r.note && <p className="reservation-controls__note">{r.note}</p>}
                {canRespond && conflicting && <p className="reservation-controls__note" role="status">장비의 확정 예약과 겹칩니다. 다른 시간으로 대안을 제안해주세요.</p>}
                {(canRespond || canCancel) && (
                  <div className="form-actions">
                    {canRespond && (
                      <>
                        <Button
                          variant="secondary"
                          disabled={!valid || overlap || availabilityBlocked || action.busy}
                          onClick={() =>
                            action.run(
                              (signal) =>
                                requestService.reservationAction(
                                  r.id,
                                  "counter",
                                  request.version,
                                  body(),
                                  signal,
                                ),
                              "대안 일정을 제안했습니다.",
                            )
                          }
                        >
                          입력한 시간으로 대안 제안
                        </Button>
                        {canConfirm && (
                          <Button
                            disabled={action.busy || availabilityBlocked || conflicting}
                            onClick={() =>
                              action.run(
                                (signal) =>
                                  requestService.reservationAction(
                                    r.id,
                                    "confirm",
                                    request.version,
                                    {},
                                    signal,
                                  ),
                                "예약을 확정했습니다.",
                              )
                            }
                          >
                            예약 확정
                          </Button>
                        )}
                      </>
                    )}
                    {canCancel && (
                      <Button
                        variant="danger"
                        disabled={action.busy}
                        onClick={() =>
                          action.run(
                            (signal) =>
                              requestService.reservationAction(
                                r.id,
                                "cancel",
                                request.version,
                                {},
                                signal,
                              ),
                            "예약 일정을 취소했습니다.",
                          )
                        }
                      >
                        일정 취소
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Feedback action={action} />
    </section>
  );
}
