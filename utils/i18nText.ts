
export type I18nText = string | Record<string, string> | undefined | null;

export function getText(v: I18nText, lang: string = "pt-BR"): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") {
        return v[lang] || v["pt"] || v["en"] || Object.values(v)[0] || "";
    }
    return String(v);
}

export function toI18n(v: string, lang: string = "pt-BR"): Record<string, string> {
    return { [lang]: (v || "").trim() };
}

export function toNumber(v: string | number | undefined | null): number | null {
    if (v === null || v === undefined) return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : null;
}
