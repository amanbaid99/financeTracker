"use client";

import { CreditCard, MessageCircle, PieChart, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { hasQuickActions, QuickAdd } from "@/components/quick-add";
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
  { href: "/cards", label: "Credit", icon: CreditCard, match: ["/cards"] },
  { href: "/ask", label: "Ask", icon: MessageCircle, match: ["/ask"] },
];

/** The main sections, as a tab bar fixed to the bottom of the screen. */
export function AppTabs() {
  const path = usePathname();
  const showAdd = hasQuickActions(path);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul
        className={cn(
          "mx-auto grid max-w-3xl",
          showAdd ? "grid-cols-5" : "grid-cols-4",
        )}
      >
        {TABS.map((t) => {
          const active = t.match.some(
            (m) => path === m || path.startsWith(`${m}/`),
          );
          return (
            <Fragment key={t.href}>
              {showAdd && t.href === "/cards" && (
                <li className="flex items-center justify-center">
                  <QuickAdd />
                </li>
              )}
              <li>
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
            </Fragment>
          );
        })}
      </ul>
    </nav>
  );
}
