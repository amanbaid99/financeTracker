export const THEMES = ["white", "black", "beige"] as const;
export const ACCENTS = [
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "plum",
  "rose",
  "terracotta",
  "gold",
  "graphite",
] as const;
export type Theme = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];

export const THEME_COOKIE = "tracker_theme";
export const ACCENT_COOKIE = "tracker_accent";

export function asTheme(v: string | undefined | null): Theme {
  return (THEMES as readonly string[]).includes(v ?? "")
    ? (v as Theme)
    : "white";
}
export function asAccent(v: string | undefined | null): Accent {
  return (ACCENTS as readonly string[]).includes(v ?? "")
    ? (v as Accent)
    : "green";
}

export const THEME_LABELS: Record<Theme, string> = {
  white: "White",
  black: "Black",
  beige: "Beige",
};
export const ACCENT_LABELS: Record<Accent, string> = {
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  indigo: "Indigo",
  violet: "Violet",
  plum: "Plum",
  rose: "Rose",
  terracotta: "Terracotta",
  gold: "Gold",
  graphite: "Graphite",
};
export const ACCENT_SWATCH: Record<Accent, string> = {
  green: "#137a3a",
  teal: "#0f766e",
  blue: "#1d4ed8",
  indigo: "#4338ca",
  violet: "#6d28d9",
  plum: "#86198f",
  rose: "#be123c",
  terracotta: "#a8411c",
  gold: "#8a5a00",
  graphite: "#3f3f46",
};
export const THEME_SWATCH: Record<Theme, string> = {
  white: "#ffffff",
  black: "#0b0b0c",
  beige: "#f5efe4",
};

export const THEME_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: false,
};
