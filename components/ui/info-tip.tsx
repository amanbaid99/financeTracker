import { Info } from "lucide-react";

/** Small "i" that explains jargon on hover, focus or tap. */
export function InfoTip({ text, label = "What does this mean?" }: { text: string; label?: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-60 -translate-x-1/2 rounded-lg border bg-card p-2 text-xs font-normal leading-snug text-card-foreground opacity-0 shadow-md transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
