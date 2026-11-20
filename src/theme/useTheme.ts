import { useSyncExternalStore } from "react";

const key = "astra.theme.v1";
const event = "astra:theme-change";
const normalize = (value) => (value === "light" ? "light" : "dark");
const snapshot = () => normalize(document.documentElement.dataset.theme);

function applyTheme(value) {
  const theme = normalize(value);
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "light" ? "#eef3fa" : "#080f1e";
  window.dispatchEvent(new Event(event));
}

export function initializeTheme() {
  try {
    applyTheme(window.localStorage.getItem(key));
  } catch {
    applyTheme("dark");
  }
}

function subscribe(listener) {
  const storage = (change) => {
    if (change.key === key || change.key === null) applyTheme(change.newValue);
  };
  window.addEventListener(event, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(event, listener);
    window.removeEventListener("storage", storage);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "dark");
  return {
    theme,
    toggleTheme() {
      const next = snapshot() === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Keep the selected theme for this page even without persistent storage.
      }
      applyTheme(next);
    },
  };
}
