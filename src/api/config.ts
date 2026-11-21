const env = import.meta.env;

export const apiConfig = {
  baseURL: (env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, ""),
  includeMock: env.VITE_INCLUDE_MOCK_DATA === "true",
  isMock: false,
  mode: "api",
  useMockCatalog: false,
};
