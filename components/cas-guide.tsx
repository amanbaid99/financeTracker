"use client";

import { Info } from "lucide-react";
import { useCallback, useState } from "react";
import { Sheet } from "@/components/sheet";

const TABS = [
  ["mf", "Mutual funds"],
  ["demat", "Stocks & demat"],
] as const;

/** (i) button with a short guide to getting a CAS. */
export function CasGuideButton({
  label = "How to get your statement",
}: {
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("mf");
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        <Info className="size-4" aria-hidden /> {label}
      </button>
      {open && (
        <Sheet title="Getting your CAS" onClose={close}>
          <div className="space-y-4 text-sm">
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
              role="tablist"
              aria-label="Statement type"
            >
              {TABS.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={tab === v}
                  onClick={() => setTab(v)}
                  className={`rounded-md px-2 py-1.5 ${tab === v ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
                >
                  {l}
                </button>
              ))}
            </div>

            {tab === "mf" ? (
              <div className="space-y-3" role="tabpanel">
                <p className="text-muted-foreground">
                  One statement from CAMS covers every mutual fund you hold,
                  from all fund houses.
                </p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    Open <b>camsonline.com</b>, go to the investor section and
                    find statements. Choose <b>CAS: CAMS + KFintech</b>.
                  </li>
                  <li>
                    Pick <b>Detailed</b> (with transactions). That&apos;s how
                    Tracker spots your SIPs.
                  </li>
                  <li>Choose a period covering at least the last 12 months.</li>
                  <li>
                    Enter your PAN and the email your funds are registered with.
                  </li>
                  <li>
                    <b>Create a password</b> and note it down. You&apos;ll type
                    it here, and the email won&apos;t remind you.
                  </li>
                  <li>
                    The PDF reaches your email in a few minutes. Upload it here
                    with that password.
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  MF Central (mfcentral.com) and KFintech can also make a
                  detailed CAS. Menu names change now and then, so look for
                  &quot;Consolidated Account Statement&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-3" role="tabpanel">
                <p className="text-muted-foreground">
                  For shares, ETFs and bonds. You get this from NSDL or CDSL,
                  whichever holds your demat account.
                </p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    <b>Easiest:</b> find the monthly &quot;Consolidated Account
                    Statement&quot; email from NSDL or CDSL and download its
                    PDF.
                  </li>
                  <li>
                    <b>Or download one any time.</b> CDSL: cdslindia.com, CAS
                    login, with your PAN, demat account number and date of
                    birth, then an OTP. NSDL: the CAS page on nsdl.com, with
                    your PAN and date of birth.
                  </li>
                  <li>
                    The password is usually based on your PAN (sometimes with
                    your date of birth). The email says which.
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  Stocks come in as one &quot;Stocks in demat&quot; row so
                  they&apos;re easy to put toward a goal.
                </p>
              </div>
            )}

            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Tracker reads the PDF and throws it away. Your PAN, name, address
              and folio numbers are never stored, and nothing changes until you
              confirm.
            </p>
          </div>
        </Sheet>
      )}
    </>
  );
}
