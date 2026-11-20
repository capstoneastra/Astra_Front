const env = import.meta.env;
const development = env.DEV === true;
const mode =
  env.VITE_API_MODE || env.VITE_DATA_SOURCE || (development ? "mock" : "api");
export const apiConfig = {
  baseURL: (env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, ""),
  includeMock: env.VITE_INCLUDE_MOCK_DATA !== "false",
  // Production never enables MSW, even if a copied local env requests Mock.
  isMock: development && mode === "mock",
  mode: development && mode === "mock" ? "mock" : "api",
  useMockCatalog: false,
};
