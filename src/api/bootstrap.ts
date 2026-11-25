import { apiConfig } from "./config";
import { removeLegacyBusinessData } from "./legacyBusinessData";

function removeLegacyMockAccounts() {
  try {
    const key = "astra.mock.database.v3";
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null");
    if (saved?.schemaVersion !== 3 || (!Object.hasOwn(saved, "users") && !Object.hasOwn(saved, "sessions"))) return;
    delete saved.users;
    delete saved.sessions;
    if (Array.isArray(saved.organizations))
      saved.organizations = saved.organizations.filter((organization) => ![11, 12, 13].includes(organization?.id));
    window.localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    /* Local browser storage is optional. */
  }
}

export async function initializeApi() {
  // Preserve the existing account cleanup behavior outside development previews.
  if (!apiConfig.preview) removeLegacyMockAccounts();
  try {
    removeLegacyBusinessData(window.localStorage);
  } catch {
    /* Local browser storage is optional. */
  }
  // Deactivate and remove only ASTRA's MSW; never touch unrelated service workers.
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) =>
          [
            registration.active,
            registration.waiting,
            registration.installing,
          ].some(
            (worker) =>
              worker &&
              new URL(worker.scriptURL).pathname.endsWith(
                "/mockServiceWorker.js",
              ),
          ),
        )
        .map(async (registration) => {
          registration.active?.postMessage({ type: "MOCK_DEACTIVATE" });
          await registration.unregister();
        }),
    );
  }
  if ((import.meta.env.DEV || (import.meta.env.MODE === "public-demo" && import.meta.env.VITE_PUBLIC_DEMO === "true")) && apiConfig.isMock) {
    const { initializeDemoApi } = await import("../demo/adapter");
    initializeDemoApi(apiConfig.preview?.account);
  }
}
