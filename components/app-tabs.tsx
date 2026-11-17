"use client";

import { CreditCard, PieChart, Radar, Target, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { hasQuickActions, QuickAdd } from "@/components/quick-add";
import { TabPending } from "@/components/nav-pending";
import { cn } from "@/lib/utils";

const BUDGET = ["/goals/budget", "/goals/salary"];
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const TABS = [
  {
    href: "/goals",
    label: "Goals",
    icon: Target,
    match: ["/goals", "/import"],
    // Budget pages sit under /goals but have their own tab.
    not: BUDGET,
  },
  { href: "/assets", label: "Net worth", icon: PieChart, match: ["/assets"] },
  { href: "/goals/budget", label: "Budget", icon: Wallet, match: BUDGET },
  { href: "/cards", label: "Cards", icon: CreditCard, match: ["/cards"] },
];

/** The main sections, as a tab bar fixed to the bottom of the screen. */
export function AppTabs({ radarEnabled = false }: { radarEnabled?: boolean }) {
  const path = usePathname();
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const showAdd = hasQuickActions(path);
  const tabs = radarEnabled
    ? [
        ...TABS,
        { href: "/radar", label: "Radar", icon: Radar, match: ["/radar"] },
      ]
    : TABS;
  // Keep viewport controls outside containers that can establish a fixed-position
  // containing block during page animations. Match server hydration before portalling.
  if (!mounted) return null;
  return createPortal(
    <>
      {radarEnabled && showAdd && (
        <div className="fixed z-30 right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))]">
          <QuickAdd />
        </div>
      )}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <ul
          className={cn(
            "mx-auto grid max-w-3xl",
            radarEnabled || showAdd ? "grid-cols-5" : "grid-cols-4",
          )}
        >
          {tabs.map((t) => {
            const under = (m: string) => path === m || path.startsWith(`${m}/`);
            const active =
              t.match.some(under) && !("not" in t && t.not?.some(under));
            return (
              <Fragment key={t.href}>
                {showAdd && !radarEnabled && t.href === "/goals/budget" && (
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
    </>,
    document.body,
  );
}
