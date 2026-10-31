"use client";

import { Check } from "lucide-react";
import {
  ACCENT_LABELS,
  ACCENT_SWATCH,
  ACCENTS,
  type Accent,
  THEME_LABELS,
  THEME_SWATCH,
  THEMES,
  type Theme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function applyTheme(theme: Theme, accent: Accent) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
}

export function ThemePicker({
  theme,
  accent,
  onChange,
}: {
  theme: Theme;
  accent: Accent;
  onChange: (theme: Theme, accent: Accent) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium" id="theme-label">
          Theme
        </p>
        <div role="radiogroup" aria-labelledby="theme-label" className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              onClick={() => onChange(t, accent)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-3 text-sm",
                theme === t && "border-primary ring-2 ring-primary",
              )}
            >
              <span
                className="size-8 rounded-full border border-black/15"
                style={{ background: THEME_SWATCH[t] }}
                aria-hidden
              />
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium" id="accent-label">
          Accent colour
        </p>
        <div role="radiogroup" aria-labelledby="accent-label" className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={accent === a}
              aria-label={ACCENT_LABELS[a]}
              title={ACCENT_LABELS[a]}
              onClick={() => onChange(theme, a)}
              className={cn(
                "flex size-10 items-center justify-center rounded-full ring-offset-2 ring-offset-background",
                accent === a && "ring-2 ring-foreground",
              )}
              style={{ background: ACCENT_SWATCH[a] }}
            >
              {accent === a && <Check className="size-4 text-white" aria-hidden />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
