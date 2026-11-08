"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Installed apps remember the start page from when they were installed
 * (Goals, for older installs). When the app opens straight onto Goals,
 * go to Home, the default tab. Only on a fresh launch, never when you tap
 * the Goals tab or follow a link.
 */
export function LaunchHome() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    try {
      if (sessionStorage.getItem("launched")) return;
      sessionStorage.setItem("launched", "1");
    } catch {
      return;
    }
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const fresh = !document.referrer && window.history.length <= 1;
    if (installed && fresh && path === "/goals" && !window.location.search)
      router.replace("/overview");
    // Only the first page of a launch matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
