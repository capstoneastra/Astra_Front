// Public demonstrations require both a dedicated build mode and an explicit flag.
// Ordinary production builds continue to exclude the DEMO runtime and fixtures.
export const isPublicDemo = import.meta.env.MODE === "public-demo" && import.meta.env.VITE_PUBLIC_DEMO === "true";
export const demoRuntimeEnabled = import.meta.env.DEV || isPublicDemo;
