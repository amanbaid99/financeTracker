/** Removes a one-shot query param (like ?do=plan) so a refresh doesn't reopen it. */
export function clearParam(name: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
