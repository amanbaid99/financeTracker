import { DISCLAIMER } from "@/lib/legal";

/** One quiet line; the full disclaimer opens on tap. */
export function DisclaimerFooter() {
  return (
    <footer className="mt-10 text-xs text-muted-foreground">
      <details className="group">
        <summary className="cursor-pointer list-none">
          Not investment advice ·{" "}
          <span className="underline underline-offset-2 group-open:hidden">
            Read more
          </span>
          <span className="hidden underline underline-offset-2 group-open:inline">
            Show less
          </span>
        </summary>
        <p className="expand-in mt-2 leading-relaxed">{DISCLAIMER}</p>
        <p className="mt-2">
          <a href="/privacy" className="underline underline-offset-2">
            Privacy policy
          </a>
        </p>
      </details>
    </footer>
  );
}
