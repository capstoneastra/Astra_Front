/** 최근 검색어 — 사용자별로 이 브라우저에만 최대 8개 저장합니다. 저장소를 못 쓰면 조용히 무시합니다. */
const LIMIT = 8;
const keyFor = (userId: number | string) => `astra.recent-searches.${userId}`;

export function readRecentSearches(userId: number | string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(keyFor(userId)) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

function write(userId: number | string, items: string[]) {
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(items.slice(0, LIMIT)));
  } catch {
    /* 저장소를 쓸 수 없는 환경에서는 기록하지 않습니다. */
  }
}

export function addRecentSearch(userId: number | string, query: string) {
  const term = query.trim();
  if (!term) return;
  write(userId, [term, ...readRecentSearches(userId).filter((item) => item !== term)]);
}

export function removeRecentSearch(userId: number | string, query: string) {
  write(userId, readRecentSearches(userId).filter((item) => item !== query));
}

export function clearRecentSearches(userId: number | string) {
  write(userId, []);
}
