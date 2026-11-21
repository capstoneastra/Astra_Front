import { previewRouteFor } from "../preview/paths";

const env = import.meta.env;
const preview = import.meta.env.DEV && typeof window !== "undefined"
  ? previewRouteFor(window.location.pathname)
  : undefined;
const isPreview = Boolean(preview);

export const apiConfig = {
  baseURL: (isPreview ? "/api/v1" : env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, ""),
  includeMock: isPreview || env.VITE_INCLUDE_MOCK_DATA !== "false",
  // Existing development preview identities are separate from business data.
  preview,
  isPreview,
  isMock: false,
  mode: "api",
  useMockCatalog: false,
};
