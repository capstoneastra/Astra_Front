import { mockDatabase } from "./database";
import { addDays, monthOf, seoulDate } from "../domain/calendar";

// Explicit, browser-local fixtures. Never called or bundled in normal API builds.
// Equipment / institutions come from the supplied catalog; ONLY bookings are invented.
export function addCalendarDemo(month, database = mockDatabase, now = new Date()) {
  const state = database.read();
  if (state.calendarDemoMonths?.includes(month)) return;
  const today = seoulDate(now);
  const anchor = monthOf(today) === month ? today : `${month}-15`;
  const eq48 = state.equipment.find((e) => e.id === 48 && e.isActive);
  const eq44 = state.equipment.find((e) => e.id === 44 && e.isActive);
  if (!eq48 || !eq44) throw new Error("시연용 장비 48·44가 비활성화되어 예시를 추가할 수 없습니다.");
  const thermal = state.equipment.find((e) => e.isActive && e.testTypes.includes("TEMPERATURE_HUMIDITY")) ?? eq44;
  const instant = (date, time) => `${date}T${time}:00+09:00`;
  const examples = [
    [eq48, 2, "CONFIRMED", anchor, "09:00", addDays(anchor, 1), "12:00"],
    [eq48, 2, "PROPOSED", anchor, "14:00", anchor, "16:00"],
    [eq44, 2, "COUNTER_PROPOSED", anchor, "10:00", anchor, "12:00"],
    [thermal, 2, "CANCELED", anchor, "13:00", anchor, "18:00"],
    [eq48, 2, "PROPOSED", addDays(anchor, 2), "10:00", addDays(anchor, 2), "12:00"],
    [eq44, 8, "CONFIRMED", addDays(anchor, 3), "09:00", addDays(anchor, 4), "00:00"],
    [thermal, 8, "PROPOSED", addDays(anchor, 4), "09:00", addDays(anchor, 5), "18:00"],
    [eq48, 2, "COUNTER_PROPOSED", addDays(`${month}-28`, 0), "09:00", addDays(`${month}-28`, 5), "18:00"],
  ];
  for (const [equipment, ownerId, status, startDay, startTime, endDay, endTime] of examples) {
    const id = ++state.sequence;
    const startAt = instant(startDay, startTime), endAt = instant(endDay, endTime);
    // Existing real demo workflows win: do not insert conflicting confirmed fixtures.
    if (status === "CONFIRMED" && state.reservations.some((r) => r.status === "CONFIRMED" && r.equipmentId === equipment.id &&
      Date.parse(startAt) < Date.parse(r.endAt) && Date.parse(endAt) > Date.parse(r.startAt))) continue;
    const companyName = ownerId === 2 ? "가상 A기업" : "DEMO 다른 기업";
    const content = { applicant: { companyName, contactName: "시연 담당자", email: ownerId === 2 ? "company@astra.demo" : "other@astra.demo", phone: "" },
      test: { testTypeCode: equipment.testTypes[0], purpose: "DEMO 캘린더 업무 흐름 시연", standard: "확인 필요" },
      sample: { name: "DEMO 가상 시료", quantity: 1, readyDate: startDay }, conditions: [],
      schedule: { desiredStartDate: startDay, desiredEndDate: endDay }, equipment: { id: equipment.id, name: equipment.name, externalId: equipment.externalId }, notes: "DEMO · 실제 시험 의뢰·예약이 아닙니다." };
    state.requests.push({ id, ownerId, institutionId: equipment.institution.id, equipmentId: equipment.id, equipmentName: equipment.name,
      externalId: equipment.externalId, requirementId: null, matchResultId: null, requestNo: `DEMO-CAL-${id}`, title: `DEMO ${equipment.name} 시험 일정`,
      status: status === "CONFIRMED" ? "CONFIRMED" : "SCHEDULING", version: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(), submittedAt: now.toISOString(),
      revisions: [{ revisionNo: 1, isAiGenerated: false, content, createdAt: now.toISOString(), changeSummary: "DEMO 캘린더 예시" }],
      history: [{ id: ++state.sequence, fromStatus: "UNDER_REVIEW", toStatus: status === "CONFIRMED" ? "CONFIRMED" : "SCHEDULING", createdAt: now.toISOString(), changedBy: { id: 1, name: "DEMO 시연" }, note: "가상 예약 시연 데이터" }] });
    state.reservations.push({ id: ++state.sequence, requestId: id, equipmentId: equipment.id, startAt, endAt, status, note: "DEMO · 실제 예약이 아닙니다.", createdAt: now.toISOString(), externalSystem: null, externalRef: null });
  }
  state.calendarDemoMonths = [...(state.calendarDemoMonths ?? []), month];
  database.write(state);
}
