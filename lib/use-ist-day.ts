"use client";
import { useSyncExternalStore } from "react";
import { todayIST } from "./dates";
const currentDay = () => todayIST();
function subscribe(notify: () => void) {
  const visible = () => { if (document.visibilityState === "visible") notify(); };
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("focus", visible);
  const timer = window.setInterval(visible, 60000);
  return () => {
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("focus", visible);
    window.clearInterval(timer);
  };
}
/** Hydrates with the server date, then rechecks the day on foreground and while open. */
export function useISTDay(serverDay: string) {
  return useSyncExternalStore(subscribe, currentDay, () => serverDay);
}
