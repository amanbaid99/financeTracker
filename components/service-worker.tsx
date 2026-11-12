"use client";

import { useEffect } from "react";

/** Registers /sw.js in production: app files cached, an offline page. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not supported or blocked: the app works the same without it.
    });
  }, []);
  return null;
}
