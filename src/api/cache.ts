export const DATA_CHANGED = "astra:data-changed";
export function invalidateData() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(DATA_CHANGED));
}
