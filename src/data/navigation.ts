import {
  LayoutDashboard,
  Telescope,
  ClipboardList,
  Database,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const navigation: { label: string; items: { id: string; label: string; icon: LucideIcon; upcoming?: boolean }[] }[] = [
  {
    label: "워크스페이스",
    items: [{ id: "home", label: "대시보드", icon: LayoutDashboard }],
  },
  {
    label: "장비 탐색",
    items: [
      { id: "search", label: "시험장비 검색", icon: Telescope },
    ],
  },
  {
    label: "시험 업무",
    items: [
      { id: "reservationCheck", label: "시험 의뢰 관리", icon: ClipboardList },
      { id: "calendar", label: "시험 예약 캘린더", icon: CalendarDays },
    ],
  },
  {
    label: "운영 관리",
    items: [
      { id: "manager", label: "보유 장비 관리", icon: Database },
      { id: "admin", label: "회원·기관 승인", icon: ShieldCheck },
    ],
  },
];

export const menuLabels: Record<string, string> = {
  ...Object.fromEntries(navigation.flatMap((group) =>
    group.items.map((item) => [item.id, item.label]),
  )),
  matching: "AI 자동 매칭",
  compare: "장비 비교",
  testInfo: "시험 정보 안내",
  reservation: "시험 의뢰하기",
  review: "시험 의뢰 관리",
  duplicates: "중복·유사 장비 조회",
  simulation: "가상 시뮬레이션",
  notifications: "업무 알림",
};

export const parentMenu: Record<string, string> = {
  matching: "search",
  compare: "search",
  testInfo: "search",
  duplicates: "search",
  simulation: "search",
  reservation: "reservationCheck",
  review: "reservationCheck",
};
