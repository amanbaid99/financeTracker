// Merging of per-user config overrides (settings.config_overrides).

export type Obj = { [k: string]: unknown };
/** Split objects are saved whole, never merged part by part. */
const LEAF_OBJECTS = new Set(["variableSurplus", "bonusSurplus", "secondarySurplus"]);

/** Deep-merges a patch into existing overrides. null removes a key; undefined leaves it. */
export function mergeOverrides(base: Obj, patch: Obj): Obj {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) {
      delete out[k];
    } else if (typeof v === "object" && !Array.isArray(v) && !LEAF_OBJECTS.has(k)) {
      const merged = mergeOverrides((out[k] as Obj) ?? {}, v as Obj);
      if (Object.keys(merged).length) out[k] = merged;
      else delete out[k];
    } else {
      out[k] = v;
    }
  }
  return out;
}
