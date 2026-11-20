export const previewRoutes = [
  { path: "/preview/company", account: "company", label: "기업 회원" },
  { path: "/preview/institution", account: "institution", label: "기관 담당자" },
  { path: "/preview/university", account: "university", label: "대학 담당자" },
  { path: "/preview/admin", account: "admin", label: "플랫폼 관리자" },
] as const;

export type PreviewAccount = (typeof previewRoutes)[number]["account"];

export function previewRouteFor(pathname: string) {
  const path = pathname.replace(/\/$/, "");
  if (path === "/preview") return previewRoutes[0];
  return previewRoutes.find((route) => route.path === path);
}
