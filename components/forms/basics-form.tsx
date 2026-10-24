"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Input, Select } from "@/components/ui/input";
import { saveBasics } from "@/lib/actions";
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
import { Field } from "./field";
import { StepShell } from "./step-shell";

export interface BasicsInitial {
  name: string;
  age: number | null;
  cityTier: "metro" | "tier2" | "tier3" | null;
  theme: Theme;
  accent: Accent;
}

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

export function BasicsForm({
  initial,
  next,
  back,
  editing,
}: {
  initial: BasicsInitial;
  next: string;
  back: string | null;
  editing: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [age, setAge] = useState(initial.age?.toString() ?? "");
  const [cityTier, setCityTier] = useState(initial.cityTier ?? "");
  const [theme, setTheme] = useState(initial.theme);
  const [accent, setAccent] = useState(initial.accent);

  return (
    <StepShell
      optional={false}
      editing={editing}
      next={next}
      back={back}
      onSave={() =>
        saveBasics({
          name,
          age: Number(age),
          cityTier: (cityTier || null) as BasicsInitial["cityTier"],
          theme,
          accent,
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" className="sm:col-span-2">
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </Field>
        <Field label="Age" htmlFor="age" hint="Used for your retirement timeline.">
          <Input
            id="age"
            required
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
        </Field>
        <Field
          label="City type"
          htmlFor="city"
          tip="Health care costs more in metros, so the health cover target is higher there (₹10L vs ₹5L)."
        >
          <Select id="city" value={cityTier} onChange={(e) => setCityTier(e.target.value)}>
            <option value="">Prefer not to say</option>
            <option value="metro">Metro (Mumbai, Delhi NCR, Bengaluru…)</option>
            <option value="tier2">Tier 2 city</option>
            <option value="tier3">Tier 3 city or town</option>
          </Select>
        </Field>
      </div>
      <ThemePicker
        theme={theme}
        accent={accent}
        onChange={(t, a) => {
          setTheme(t);
          setAccent(a);
          applyTheme(t, a);
        }}
      />
    </StepShell>
  );
}
