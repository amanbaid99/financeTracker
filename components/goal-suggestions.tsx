"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/sheet";
import { Input } from "@/components/ui/input";
import {saveGoalMapping} from "@/lib/goal-suggestion-actions";
import { formatINR } from "@/lib/format";
import type { MappingSuggestion } from "@/lib/goal-suggestions";

type Holding = { id: string; label: string; value: number; availablePercent?: number };

/**
 * Optional manual coverage edit inside one goal. Never reduces other goals.
 */
export function GoalMappingControl({goalId, goalName, holdings, links}: {
 goalId:string; goalName:string; holdings:Holding[];
 links:{goalId:string;investmentId:string;percent:number}[];
}) {
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const [pending,start]=useTransition();
 const [error,setError]=useState("");
 const own=links.filter(l=>l.goalId===goalId);
 const suggestion:MappingSuggestion={key:goalId,goalId,goalName,now:"",proposed:own.map(l=>{
  const h=holdings.find(h=>h.id===l.investmentId);
  return {...l,label:h?.label??"Holding",value:Math.round((h?.value??0)*l.percent/100)};
 })};
 return <>
  <Button variant="ghost" size="sm" onClick={()=>setOpen(true)}>Change what covers this goal</Button>
  {open&&<ChangeSheet suggestion={suggestion} holdings={holdings.map(h=>({...h,availablePercent:Math.max(0,Math.round((100-links.filter(l=>l.goalId!==goalId&&l.investmentId===h.id).reduce((sum,l)=>sum+l.percent,0))*100)/100)}))} pending={pending} error={error}
   onClose={()=>!pending&&setOpen(false)} onSave={rows=>start(async()=>{
    setError("");
    try {const res=await saveGoalMapping({goalId,rows});if(!res.ok)return setError(res.error);setOpen(false);router.refresh();}
    catch {setError("Connection interrupted. Refresh to check your coverage before retrying.");}
   })}/>}
 </>;
}

function ChangeSheet({
  suggestion,
  holdings,
  pending,
  error,
  onClose,
  onSave,
}: {
  suggestion: MappingSuggestion;
  holdings: Holding[];
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (rows: { investmentId: string; percent: number }[]) => void;
}) {
  const [share, setShare] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      suggestion.proposed.map((r) => [
        r.investmentId,
        String(r.percent),
      ]),
    ),
  );
  const rows = holdings
    .map((h) => ({ investmentId: h.id, percent: Number(share[h.id] || 0) }))
    .filter((r) => r.percent > 0);
  const bad = holdings.some(h=>{const v=share[h.id]??"";return v!==""&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>(h.availablePercent??100)||Math.abs(Number(v)*100-Math.round(Number(v)*100))>0.00001);});
  return (
    <Sheet title={`What covers ${suggestion.goalName}?`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!bad) onSave(rows);
        }}
      >
        <p className="text-sm text-muted-foreground">
          Set the share of each holding for this goal. Other goals keep their money. A share already used elsewhere cannot be assigned again.
        </p>
        <ul className="divide-y">
          {holdings.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0 text-sm">
                <span className="block break-words font-medium">{h.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatINR(h.value)} · Up to {h.availablePercent??100}% available
                </span>
              </span>
              <span className="flex w-24 shrink-0 items-center gap-1">
                <Input
                  aria-label={`${h.label} share for ${suggestion.goalName}, %`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={h.availablePercent??100}
                  step="0.01"
                  value={share[h.id] ?? ""}
                  placeholder="0"
                  onChange={(e) =>
                    setShare((s) => ({ ...s, [h.id]: e.target.value }))
                  }
                />
                <span className="text-sm text-muted-foreground">%</span>
              </span>
            </li>
          ))}
        </ul>
        {bad && (
          <p role="alert" className="text-sm text-danger">
            Use no more than the available share, with up to two decimal places.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending || bad}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Sheet>
  );
}
