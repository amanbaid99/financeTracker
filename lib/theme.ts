export const THEMES = ["white", "black", "beige"] as const;
export const ACCENTS = ["green", "blue", "terracotta", "violet"] as const;
export type Theme = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];

export const THEME_COOKIE = "tracker_theme";
export const ACCENT_COOKIE = "tracker_accent";

export function asTheme(v: string | undefined | null): Theme {
  return (THEMES as readonly string[]).includes(v ?? "") ? (v as Theme) : "white";
}
export function asAccent(v: string | undefined | null): Accent {
  return (ACCENTS as readonly string[]).includes(v ?? "") ? (v as Accent) : "green";
}

export const THEME_LABELS: Record<Theme, string> = { white: "White", black: "Black", beige: "Beige" };
export const ACCENT_LABELS: Record<Accent, string> = {
  green: "Green",
  blue: "Blue",
  terracotta: "Terracotta",
  violet: "Violet",
};
export const ACCENT_SWATCH: Record<Accent, string> = {
  green: "#15803d",
  blue: "#1d4ed8",
  terracotta: "#b4471f",
  violet: "#6d28d9",
};
export const THEME_SWATCH: Record<Theme, string> = { white: "#ffffff", black: "#0b0b0c", beige: "#f5efe4" };

export const THEME_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: false,
};
