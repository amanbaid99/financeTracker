"use client";

import { CreditCard, MessageCircle, PieChart, Target } from "lucide-react";
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

/** The main sections, as a row of tabs under the header. */
export function AppTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="mx-auto w-full max-w-3xl px-4">
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const active = t.match.some(
            (m) => path === m || path.startsWith(`${m}/`),
          );
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-medium",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-4" aria-hidden />
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
