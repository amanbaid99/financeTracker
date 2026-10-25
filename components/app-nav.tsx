"use client";

import {
  CalendarCheck,
  Home,
  PiggyBank,
  RefreshCw,
  Settings,
  Target,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/month", label: "This month", icon: CalendarCheck },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/holdings", label: "Holdings", icon: PiggyBank },
  { href: "/details", label: "My details", icon: UserRound },
];

export function AppNav() {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <Link href="/dashboard" aria-label="Tracker home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="ml-auto hidden gap-1 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  active(l.href) && "bg-muted text-foreground",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 md:ml-2">
            <Link
              href="/update"
              aria-current={active("/update") ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted",
                active("/update") && "bg-muted",
              )}
            >
              <RefreshCw className="size-4" aria-hidden />
              Update
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              aria-current={active("/settings") ? "page" : undefined}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
                active("/settings") && "bg-muted text-foreground",
              )}
            >
              <Settings className="size-5" aria-hidden />
            </Link>
          </div>
        </div>
      </header>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-6">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] leading-tight text-muted-foreground whitespace-nowrap",
                  active(l.href) && "text-primary",
                )}
              >
                <l.icon className="size-5" aria-hidden />
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
