const BUSINESS_KEYS = [
  "sequence", "equipment", "testTypes", "rules", "models", "presets",
  "equipmentTestTypes", "chats", "requirements", "matchRuns", "requests",
  "reservations", "supplements", "simulations", "autoRuns", "notifications",
  "changeLogs", "calendarDemoMonths",
] as const;

// Remove only the retired functional fixtures. Account, session, organization
// and unknown fields are deliberately preserved; never clear browser storage.
export function removeLegacyBusinessData(storage: Pick<Storage, "getItem" | "setItem">) {
  const key = "astra.mock.database.v3";
  try {
    const saved = JSON.parse(storage.getItem(key) ?? "null");
    if (!saved || saved.schemaVersion !== 3 || Array.isArray(saved)) return;
    let changed = false;
    for (const field of BUSINESS_KEYS) {
      if (!Object.hasOwn(saved, field)) continue;
      delete saved[field];
      changed = true;
    }
    if (changed) storage.setItem(key, JSON.stringify(saved));
  } catch {
    /* Corrupt or unavailable storage must not block application startup. */
  }
}
