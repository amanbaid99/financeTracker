import { DISCLAIMER } from "@/lib/legal";

export function DisclaimerFooter() {
  return (
    <footer className="mt-10 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
      <p>{DISCLAIMER}</p>
      <p className="mt-2">
        <a href="/privacy" className="underline underline-offset-2">
          Privacy policy
        </a>
      </p>
    </footer>
  );
}
