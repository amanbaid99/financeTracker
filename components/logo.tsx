import { cn } from "@/lib/utils";

/** Tracker mark: a rupee sign on an accent tile. Follows the user's accent colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path
        d="M10 9h12M10 14h12M10 9h4.5a5 5 0 0 1 0 10H11l8 7"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className="size-7" />
      <span className="text-lg">Tracker</span>
    </span>
  );
}
