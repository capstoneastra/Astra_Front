import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createServer } from "vite";

// Storage fixtures below exist only in this check, never in the application.
const key = "astra.mock.database.v3";
const migrationSource = await readFile("src/api/legacyBusinessData.ts", "utf8");
const { outputText } = ts.transpileModule(migrationSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { removeLegacyBusinessData } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const accountFields = { users: [{ preserved: true }], sessions: [{ preserved: true }],
  organizations: [{ preserved: true }], futureField: { preserved: true } };
const original = { schemaVersion: 3, ...accountFields, equipment: [1], requests: [2],
  reservations: [3], simulations: [4], matchRuns: [5], calendarDemoMonths: [6] };
const saved = new Map([[key, JSON.stringify(original)], ["unrelated", "untouched"]]);
let writes = 0;
const storage = { getItem: (name) => saved.get(name) ?? null,
  setItem: (name, value) => { saved.set(name, value); writes++; } };
removeLegacyBusinessData(storage);
assert.deepEqual(JSON.parse(saved.get(key)), { schemaVersion: 3, ...accountFields });
assert.equal(saved.get("unrelated"), "untouched");
removeLegacyBusinessData(storage);
assert.equal(writes, 1, "Migration must be idempotent");
for (const raw of [null, "not-json", "null", "[]", '{"schemaVersion":4,"equipment":[1]}']) {
  removeLegacyBusinessData({ getItem: () => raw,
    setItem: () => assert.fail("Unknown/corrupt storage must not be rewritten") });
}
assert.doesNotThrow(() => removeLegacyBusinessData({
  getItem: () => { throw new Error("Storage blocked"); }, setItem: () => {},
}));
console.log("PASS: legacy business data removed; account/session/organization/unknown data preserved");

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesIn(`${directory}/${entry.name}`) : `${directory}/${entry.name}`))).flat();
}
const sources = await filesIn("src");
assert(!sources.some((file) => file.startsWith("src/mocks/")));
for (const file of sources.filter((file) => /\.[cm]?[jt]sx?$/.test(file))) {
  const source = await readFile(file, "utf8");
  assert(!/from\s+["'][^"']*\/mocks\/|import\(["'][^"']*\/mocks\//.test(source), file);
  assert(!source.includes("initializePreviewApi"), file);
}
const manifest = JSON.parse(await readFile("package.json", "utf8"));
assert(!manifest.dependencies?.msw && !manifest.devDependencies?.msw);
const viteConfig = await readFile("vite.config.ts", "utf8");
assert(!viteConfig.includes("serveMockWorker"));
console.log("PASS: functional mock modules, preview business adapter and MSW dependency/startup removed");

const protectedPaths = ["src/auth", "src/services/authService.ts", "src/api/client.ts",
  "src/api/errors.ts", "src/preview/PreviewProvider.tsx", "src/preview/paths.ts", "src/preview/user.ts",
  "src/index.css", "src/styles", "src/components/layout/AppHeader.tsx"];
execFileSync("git", ["diff", "--exit-code", "83ac98f", "--", ...protectedPaths], { stdio: "pipe" });
const baselineBootstrap = execFileSync("git", ["show", "83ac98f:src/api/bootstrap.ts"], { encoding: "utf8" });
const currentBootstrap = await readFile("src/api/bootstrap.ts", "utf8");
const legacyAccountHelper = (source) => source.replaceAll("\r\n", "\n")
  .split("function removeLegacyMockAccounts() {")[1].split("export async function initializeApi")[0];
assert.equal(legacyAccountHelper(currentBootstrap), legacyAccountHelper(baselineBootstrap));
console.log("PASS: auth/signup files, auth transport, preview identities, account cleanup helper and styles unchanged");

// Render the actual shared state component without starting an API or inventing responses.
process.env.VITE_API_MODE = "mock";
const server = await createServer({ root: resolve("."), server: { middlewareMode: true }, appType: "custom" });
try {
  const { apiConfig } = await server.ssrLoadModule("/src/api/config.ts");
  assert.equal(apiConfig.isMock, false, "Legacy env must not reactivate Mock mode");
  const { default: ApiState } = await server.ssrLoadModule("/src/components/ui/ApiState.tsx");
  for (const code of ["NETWORK_ERROR", "TIMEOUT"]) {
    const html = renderToStaticMarkup(React.createElement(ApiState, { error: { code, status: 0 }, onRetry() {} }));
    assert(html.includes("서버 연결 대기") && html.includes("다시 시도"));
    assert(html.includes('role="alert"'));
  }
  const loading = renderToStaticMarkup(React.createElement(ApiState, { loading: true }));
  assert(loading.includes('role="status"') && loading.includes("서버 응답을 기다리고 있습니다"));
  for (const status of [403, 404, 409, 500]) {
    const html = renderToStaticMarkup(React.createElement(ApiState, { error: { status } }));
    assert(html.includes(String(status)));
  }
  console.log("PASS: legacy mock env disabled; actual loading/network/timeout/403/404/409/500 UI renders");
} finally {
  await server.close();
}
