import { previewRouteFor } from "../preview/paths";
import { isPublicDemo } from "./demoMode";

const env = import.meta.env;
const isDemo = isPublicDemo || (import.meta.env.DEV && env.VITE_ENABLE_DEMO === "true");
const preview = import.meta.env.DEV && !isDemo && typeof window !== "undefined"
  ? previewRouteFor(window.location.pathname)
  : undefined;
const isPreview = Boolean(preview);
// DEMO uses an isolated session; ordinary production keeps backend JWT auth.

export const apiConfig = {
  baseURL: (isPreview || isDemo ? "/api/v1" : env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, ""),
  includeMock: isPreview || isDemo || env.VITE_INCLUDE_MOCK_DATA !== "false",
  // Existing development preview identities are separate from business data.
  preview,
  isPreview,
  isMock: isDemo,
  isPublicDemo,
  mode: isDemo ? "demo" : "api",
  useMockCatalog: false,
};
