import {
  LayoutDashboard,
  Telescope,
  Sparkles,
  Columns3,
  BotMessageSquare,
  FilePlus2,
  ClipboardList,
  ClipboardCheck,
  Copy,
  Database,
  BookOpen,
  Activity,
  ShieldCheck,
  Bell,
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
      { id: "matching", label: "AI 자동 매칭", icon: Sparkles },
      { id: "compare", label: "장비 비교", icon: Columns3 },
      { id: "testInfo", label: "시험 정보 안내", icon: BookOpen },
    ],
  },
  {
    label: "시험 업무",
    items: [
      { id: "calendar", label: "시험 예약 캘린더", icon: CalendarDays },
      { id: "reservation", label: "시험 의뢰하기", icon: FilePlus2 },
      { id: "reservationCheck", label: "내 의뢰 관리", icon: ClipboardList },
      {
        id: "review",
        label: "기관 검토·보완",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "AI 지원",
    items: [
      { id: "assistant", label: "AI 어시스턴트", icon: BotMessageSquare },
    ],
  },
  {
    label: "운영 관리",
    items: [
      { id: "duplicates", label: "중복 장비 조회", icon: Copy },
      { id: "manager", label: "장비 데이터 관리", icon: Database },
      { id: "simulation", label: "가상 시뮬레이션", icon: Activity },
      { id: "admin", label: "회원·기관 승인", icon: ShieldCheck },
      { id: "notifications", label: "업무 알림", icon: Bell },
    ],
  },
];

export const menuLabels = Object.fromEntries(
  navigation.flatMap((group) =>
    group.items.map((item) => [item.id, item.label]),
  ),
);
