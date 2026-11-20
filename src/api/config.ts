import { previewRouteFor } from "../preview/paths";

const env = import.meta.env;
const mode = env.VITE_API_MODE || env.VITE_DATA_SOURCE || "api";
const preview = import.meta.env.DEV && typeof window !== "undefined"
  ? previewRouteFor(window.location.pathname)
  : undefined;
const isPreview = Boolean(preview);
const isMock = isPreview || (import.meta.env.DEV && mode === "mock");

export const apiConfig = {
  baseURL: (isPreview ? "/api/v1" : env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, ""),
  includeMock: isPreview || env.VITE_INCLUDE_MOCK_DATA !== "false",
  // The preview and MSW are both development-only.
  preview,
  isPreview,
  isMock,
  mode: isMock ? "mock" : "api",
  useMockCatalog: false,
};
