/**
 * 큰 화면(2K·4K 모니터, TV, 프로젝터 고해상도 출력)에서 화면 전체를 비율대로 키운다.
 *
 * - 레이아웃은 1920×950 정도를 기준으로 짜여 있다. 그보다 큰 화면에서는 `html { zoom }` 으로
 *   글자·간격·표를 함께 키워, 4K TV에서도 1920 화면과 같은 배치로 보이게 한다.
 * - 배율은 단계가 아니라 연속값이고 지수 0.85 를 써서, 브라우저 확대(Ctrl +)를 누르면
 *   화면이 항상 "커지는" 방향으로만 바뀐다 (단계식이면 확대했는데 작아지는 구간이 생김).
 * - CSS zoom 은 vh·vw 도 같이 키우므로, 화면 높이·폭은 `--vh-full`·`--vw-full` 로 보정해서 쓴다.
 *   (`--vw-full` 은 스크롤바를 뺀 실제 폭)
 */
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 950;
const CURVE = 0.85;
const MAX_ZOOM = 2.4;

let current = 1;

export function computeAppZoom(width: number, height: number) {
  const byWidth = Math.pow(width / BASE_WIDTH, CURVE);
  const byHeight = Math.pow(height / BASE_HEIGHT, CURVE);
  const zoom = Math.min(byWidth, byHeight, MAX_ZOOM);
  return zoom > 1.03 ? Math.round(zoom * 100) / 100 : 1;
}

/** 지금 화면 배율 — getBoundingClientRect 값(확대된 값)을 style 의 px 로 되돌릴 때 나눠 쓴다 */
export const appZoom = () => current;

function apply() {
  const root = document.documentElement;
  const zoom = computeAppZoom(window.innerWidth, window.innerHeight);
  current = zoom;
  root.style.setProperty("--app-zoom", String(zoom));
  root.style.setProperty("--vw-full", `${root.clientWidth / zoom}px`);
  root.dataset.zoomed = zoom > 1 ? "true" : "false";
}

export function initializeAppZoom() {
  apply();
  let frame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
  });
}
