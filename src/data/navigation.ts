import {
  LayoutDashboard,
  Telescope,
  ClipboardList,
  Database,
  ShieldCheck,
  CalendarDays,
  ChartColumn,
  FlaskConical,
  Sparkles,
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
      { id: "quickRequest", label: "AI 간편 의뢰", icon: Sparkles },
      { id: "reservationCheck", label: "시험 의뢰 관리", icon: ClipboardList },
      { id: "calendar", label: "시험 예약 캘린더", icon: CalendarDays },
    ],
  },
  {
    // v7: 시뮬레이션은 '장비 찾기'가 아니라 의뢰 전 검토 도구라 별도 묶음으로 분리
    label: "분석 도구",
    items: [
      { id: "simulation", label: "가상 시뮬레이션", icon: FlaskConical },
    ],
  },
  {
    label: "운영 관리",
    items: [
      { id: "manager", label: "보유 장비 관리", icon: Database },
      { id: "admin", label: "회원·기관 승인", icon: ShieldCheck },
      { id: "stats", label: "운영 통계", icon: ChartColumn },
    ],
  },
];

/** 역할에 따라 메뉴 이름이 다른 경우 (v11: 관리자는 기관들이 등록한 장비 전체를 관리하므로 '등록 장비 관리') */
export function menuLabel(id: string, role: string | undefined, fallback: string) {
  if (id === "manager" && role === "ADMIN") return "등록 장비 관리";
  return fallback;
}

export const parentMenu: Record<string, string> = {
  matching: "search",
  compare: "search",
  testInfo: "search",
  reservation: "reservationCheck",
  review: "reservationCheck",
};
