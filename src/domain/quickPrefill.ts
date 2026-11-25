/**
 * 대시보드 첫 칸 → AI 간편 의뢰 페이지로 글·첨부 파일을 넘기는 약속 (세션 저장소)
 * v15: 'AI 간편 의뢰'는 챗봇 대신 AI 간편 의뢰 페이지로 넘깁니다. (챗봇으로 넘기던 v12~v14 코드는 삭제)
 */
/** 대시보드 입력칸에 추가한 파일. 글 파일(txt·csv 등)만 내용(text)을 읽어 둡니다. */
export interface HeroFile { name: string; size: number; text?: string }
export interface QuickPrefill { text: string; files: HeroFile[] }

export const QUICK_PREFILL_KEY = "astra.quick-request.prefill";
export function writeQuickPrefill(value: QuickPrefill) {
  try { window.sessionStorage.setItem(QUICK_PREFILL_KEY, JSON.stringify(value)); } catch { /* 저장소를 못 쓰는 환경은 무시 */ }
}
/** 한 번 읽으면 지웁니다. */
export function takeQuickPrefill(): QuickPrefill | null {
  try {
    const raw = window.sessionStorage.getItem(QUICK_PREFILL_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(QUICK_PREFILL_KEY);
    const parsed = JSON.parse(raw) as Partial<QuickPrefill>;
    return { text: parsed.text ?? "", files: Array.isArray(parsed.files) ? parsed.files : [] };
  } catch { return null; }
}
