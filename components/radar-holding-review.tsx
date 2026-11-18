"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/forms/field";
import { Input, Select, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveRadarHoldingReview } from "@/lib/radar/actions";
import type { HoldingReview } from "@/lib/radar/holding-review";
import { todayIST } from "@/lib/dates";
import { formatDate } from "@/lib/format";

export function RadarHoldingReview({ id, review, canSave = true }: { id: string; review?: HoldingReview; canSave?: boolean }) {
  const uid = useId(), router = useRouter();
  const [target, setTarget] = useState(review?.targetSharePct.toString() ?? "");
  const [band, setBand] = useState(review?.rebalanceBandPct.toString() ?? "");
  const [cost, setCost] = useState(review?.estimatedExitCostPct.toString() ?? "");
  const [thesis, setThesis] = useState(review?.thesis ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const amount = (value: string) => value === "" ? NaN : Number(value);
  function save(clear = false) {
    start(async () => {
      setMessage(""); setError("");
      const result = await saveRadarHoldingReview(id, clear ? null : { targetSharePct: amount(target), rebalanceBandPct: amount(band),
        estimatedExitCostPct: amount(cost), thesis, ownershipConfirmed: confirmed, contextConfirmed: confirmed, costsReviewed: confirmed });
      if (!result.ok) setError(result.error ?? "Couldn't save the review.");
      else {
        setConfirmed(false);
        if (clear) { setTarget(""); setBand(""); setCost(""); setThesis(""); }
        setMessage(clear ? "Holding review removed." : "Holding review saved. The investment assessment is still pending.");
        router.refresh();
      }
    });
  }
  if (!canSave) return <div className="space-y-2 border-t pt-3">
    <p className="text-muted-foreground">A current confirmed stock holding is needed to update this review. You can remove the saved review.</p>
    <Button type="button" variant="outline" disabled={pending} onClick={() => save(true)}>Remove review</Button>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {message && <p role="status" className="text-primary">{message}</p>}
  </div>;
  return <details className="border-t pt-2">
    <summary className="min-h-11 flex items-center cursor-pointer font-medium">Review holding details</summary>
    <form className="space-y-3 pt-2" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <p className="text-muted-foreground">These inputs prepare a future holding assessment. Saving does not enable Buy/Hold/Sell. Reviews older than 90 days need updating.</p>
      {review && <p className="text-xs text-muted-foreground">Last reviewed {formatDate(todayIST(new Date(review.reviewedAt)))}</p>}
      <fieldset disabled={pending} className="space-y-3">
        <Field label="Target share of tracked investments (%)" htmlFor={`${uid}-target`}>
          <Input id={`${uid}-target`} type="number" inputMode="decimal" min="0" max="100" step="0.01" required value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="Allowed above target (percentage points)" htmlFor={`${uid}-band`} hint="For a 10% target, an allowance of 2 means review above 12%.">
          <Input id={`${uid}-band`} type="number" inputMode="decimal" min="0" max="100" step="0.01" required value={band} onChange={(e) => setBand(e.target.value)} />
        </Field>
        <Field label="Does your reason for owning it still hold?" htmlFor={`${uid}-thesis`}>
          <Select id={`${uid}-thesis`} required value={thesis} onChange={(e) => setThesis(e.target.value as typeof thesis)}>
            <option value="">Choose a status</option><option value="intact">Yes</option><option value="uncertain">Needs review</option><option value="broken">No</option>
          </Select>
        </Field>
        <Field label="Estimated total exit cost (%)" htmlFor={`${uid}-cost`} hint="Your estimate of selling costs as a share of the position value. This app does not calculate tax here.">
          <Input id={`${uid}-cost`} type="number" inputMode="decimal" min="0" max="100" step="0.01" required value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <label className="flex items-start gap-2"><Checkbox required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>I confirm I hold this investment and have reviewed these details.</span></label>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!confirmed}>Save holding review</Button>{review && <Button type="button" variant="outline" onClick={() => save(true)}>Remove review</Button>}</div>
      </fieldset>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {message && <p role="status" className="text-primary">{message}</p>}
    </form>
  </details>;
}
