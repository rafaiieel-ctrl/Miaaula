
const FLAGS_KEY = "revApp_discipline_flags_v1";

type DisciplineFlags = Record<string, { frozen?: boolean; frozenAt?: string }>;

export function normalizeKey(s: string) {
  return (s || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/");
}

function loadFlags(): DisciplineFlags {
  try { return JSON.parse(localStorage.getItem(FLAGS_KEY) || "{}"); }
  catch { return {}; }
}

function saveFlags(flags: DisciplineFlags) {
  localStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
}

export function isFrozen(name: string) {
  const key = normalizeKey(name);
  const flags = loadFlags();
  return !!flags[key]?.frozen;
}

export function setFrozen(name: string, frozen: boolean) {
  const key = normalizeKey(name);
  const flags = loadFlags();
  flags[key] = {
    ...(flags[key] || {}),
    frozen,
    frozenAt: frozen ? new Date().toISOString() : undefined
  };
  saveFlags(flags);
}

export function getFrozenSet(): Set<string> {
    const flags = loadFlags();
    const set = new Set<string>();
    for (const [k, v] of Object.entries(flags)) {
        if (v.frozen) set.add(k);
    }
    return set;
}
