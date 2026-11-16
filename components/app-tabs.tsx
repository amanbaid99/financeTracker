"use client";

import { CreditCard, PieChart, Target, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { hasQuickActions, QuickAdd } from "@/components/quick-add";
import { TabPending } from "@/components/nav-pending";
import { cn } from "@/lib/utils";

const BUDGET = ["/goals/budget", "/goals/salary"];

const TABS = [
  {
    href: "/goals",
    label: "Goals",
    icon: Target,
    match: ["/goals", "/import"],
    // Budget pages sit under /goals but have their own tab.
    not: BUDGET,
  },
  { href: "/goals/budget", label: "Budget", icon: Wallet, match: BUDGET },
  { href: "/assets", label: "Assets", icon: PieChart, match: ["/assets"] },
  { href: "/cards", label: "Cards", icon: CreditCard, match: ["/cards"] },
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
          const under = (m: string) => path === m || path.startsWith(`${m}/`);
          const active =
            t.match.some(under) && !("not" in t && t.not?.some(under));
          return (
            <Fragment key={t.href}>
              {showAdd && t.href === "/assets" && (
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
