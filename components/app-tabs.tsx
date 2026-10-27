"use client";

import {
  CreditCard,
  MessageCircle,
  PieChart,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TabPending } from "@/components/nav-pending";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/goals",
    label: "Goals",
    icon: Target,
    match: ["/goals", "/import"],
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: PieChart,
    match: ["/portfolio"],
  },
  { href: "/cards", label: "Cards", icon: CreditCard, match: ["/cards"] },
  { href: "/ask", label: "Ask", icon: MessageCircle, match: ["/ask"] },
];

/** The main sections, as a tab bar fixed to the bottom of the screen. */
export function AppTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {TABS.map((t) => {
          const active = t.match.some(
            (m) => path === m || path.startsWith(`${m}/`),
          );
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                transitionTypes={["tab"]}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press relative flex flex-col items-center gap-0.5 pb-2 pt-2 text-[11px] font-medium",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <t.icon className="size-5" aria-hidden />
                </span>
                {t.label}
                <TabPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
