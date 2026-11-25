import type { MockRoute } from "../engine";
import { ok, pageOf, REQUEST_STATUSES } from "../http";

const groupBy = (items, key) =>
  items.reduce((all, item) => {
    const value = item[key] ?? "미확인";
    all[value] = (all[value] ?? 0) + 1;
    return all;
  }, {});
export const dashboardRoutes: MockRoute[] = [
  [
    "GET",
    "/dashboard/summary",
    (ctx) => {
      const view = ctx.user.role === "ADMIN" ? "ADMIN" : ctx.url.searchParams.get("view") ?? (ctx.user.role === "INSTITUTION_MANAGER" ? "PROVIDER" : "REQUESTER");
      const equipment = ctx.state.equipment.filter((e) => e.isActive),
        requests = ctx.state.requests.filter(
          (r) =>
            (view === "ADMIN" || (view === "PROVIDER" ? r.institutionId === ctx.user.organizationId && r.status !== "DRAFT" : r.ownerId === ctx.user.id)),
        );
      const summary = {
        role: ctx.user.role,
        view,
        requestCounts: Object.fromEntries(
          REQUEST_STATUSES.map((status) => [
            status,
            requests.filter((r) => r.status === status).length,
          ]),
        ),
        equipmentStats: {
          total: equipment.length,
          byRegion: groupBy(equipment, "region"),
        },
        dataAvailable: { requests: true },
      };
      const action = (r) => ({
        requestId: r.id,
        requestNo: r.requestNo,
        title: r.title,
        status: r.status,
        dueDate:
          ctx.state.supplements.find(
            (s) => s.requestId === r.id && s.status === "OPEN",
          )?.dueDate ?? null,
        submittedAt: r.submittedAt,
      });
      if (view === "REQUESTER")
        Object.assign(summary, {
          actionRequired: requests
            .filter((r) => r.status === "SUPPLEMENT_REQUESTED")
            .slice(0, 5)
            .map(action),
          recentChats: ctx.state.chats
            .filter((c) => c.ownerId === ctx.user.id)
            .slice(-5)
            .map(({ id, title, updatedAt }) => ({ id, title, updatedAt })),
          dataAvailable: { requests: true, chats: true },
        });
      if (view === "PROVIDER") {
        const own = equipment.filter(
            (e) => e.institution.id === ctx.user.organizationId,
          ),
          notConfirmed = own.filter(
            (e) => e.verificationStatus !== "INSTITUTION_VERIFIED",
          ).length;
        Object.assign(summary, {
          institution: {
            id: ctx.user.organizationId,
            name:
              ctx.state.organizations.find(
                (o) => o.id === ctx.user.organizationId,
              )?.name ?? "",
          },
          pendingReview: requests
            .filter((r) => ["SUBMITTED", "RESUBMITTED"].includes(r.status))
            .slice(0, 5)
            .map(action),
          equipmentNeedsUpdate: {
            total: notConfirmed,
            notConfirmed,
            outdated: 0,
          },
          upcomingReservations: ctx.state.reservations
            .filter(
              (r) =>
                r.status === "CONFIRMED" &&
                requests.some((q) => q.id === r.requestId),
            )
            .slice(0, 5)
            .map((r) => ({
              reservationId: r.id,
              requestId: r.requestId,
              requestNo: requests.find((q) => q.id === r.requestId).requestNo,
              equipmentId: r.equipmentId,
              equipmentName:
                equipment.find((e) => e.id === r.equipmentId)?.name ??
                "장비 정보 확인 필요",
              startAt: r.startAt,
              endAt: r.endAt,
            })),
        });
      }
      if (ctx.user.role === "ADMIN")
        Object.assign(summary, {
          pendingUsers: 0,
          pendingInstitutions: ctx.state.organizations.filter((organization) => !organization.isVerified).length,
        });
      return ok(summary);
    },
  ],
  [
    "GET",
    "/dashboard/equipment-stats",
    (ctx) => {
      const items = ctx.state.equipment.filter((e) => e.isActive);
      return ok({
        total: items.length,
        byRegion: groupBy(items, "region"),
        byEquipmentType: groupBy(items, "equipmentType"),
        byTestType: ctx.state.testTypes.map((t) => ({
          code: t.code,
          nameKo: t.name_ko,
          equipmentCount: items.filter((e) => e.testTypes.includes(t.code))
            .length,
        })),
        institutions: ctx.state.organizations
          .filter((o) => items.some(e => e.institution.id === o.id))
          .map((o) => ({
            id: o.id,
            name: o.name,
            region: o.region,
            equipmentCount: items.filter((e) => e.institution.id === o.id)
              .length,
            verifiedCount: items.filter(e => e.institution.id === o.id && e.verificationStatus === "INSTITUTION_VERIFIED").length,
            verificationRate: items.filter(e => e.institution.id === o.id && e.verificationStatus === "INSTITUTION_VERIFIED").length / items.filter(e => e.institution.id === o.id).length,
          })).sort((a, b) => b.equipmentCount - a.equipmentCount),
      });
    },
  ],
  [
    "GET",
    "/notifications",
    (ctx) =>
      ok(
        pageOf(
          ctx.state.notifications
            .filter(
              (n) =>
                n.userId === ctx.user.id &&
                (ctx.url.searchParams.get("unreadOnly") !== "true" ||
                  !n.isRead),
            )
            .sort((a, b) => b.id - a.id),
          ctx.url,
        ),
      ),
  ],
  [
    "GET",
    "/notifications/unread-count",
    (ctx) =>
      ok({
        count: ctx.state.notifications.filter(
          (n) => n.userId === ctx.user.id && !n.isRead,
        ).length,
      }),
  ],
  [
    "PATCH",
    "/notifications/:id/read",
    (ctx) => {
      const n = ctx.owner(
        ctx.state.notifications.find((n) => n.id === Number(ctx.params.id)),
        ctx.state.notifications.find((n) => n.id === Number(ctx.params.id))
          ?.userId,
      );
      n.isRead = true;
      return ok(n);
    },
  ],
  [
    "POST",
    "/notifications/read-all",
    (ctx) => {
      ctx.state.notifications
        .filter((n) => n.userId === ctx.user.id)
        .forEach((n) => {
          n.isRead = true;
        });
      return ok(null);
    },
  ],
];
