import { apiConfig } from "./config";
export async function initializeApi() {
  if (import.meta.env?.DEV && apiConfig.isMock) {
    const { worker } = await import("../mocks/browser");
    await worker.start({
      quiet: true,
      onUnhandledRequest: "bypass",
      serviceWorker: { url: "/mockServiceWorker.js" },
    });
    return;
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
}
