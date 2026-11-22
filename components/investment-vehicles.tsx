import { formatINR } from "@/lib/format";
import { purposeVehicles, PURPOSE_LABELS, type MonthlyVehicle } from "@/lib/investment-plan";

export function VehicleCoverage({row}:{row:MonthlyVehicle}){
 const groups=purposeVehicles([row]);
 return <div className="space-y-1 text-xs text-muted-foreground">
   {row.parts.length>0?<><p className="break-words">Covers {row.parts.map(p=>p.goalName).join(", ")}</p>{groups.length>1&&<p>{groups.map(g=>`${PURPOSE_LABELS[g.purpose]} ${formatINR(g.total)}`).join(" · ")}</p>}</>:<p>{row.fixed?"Chosen by you":"Not mapped to a goal yet."}</p>}
 </div>;
}
export function InvestmentVehicles({rows}:{rows:MonthlyVehicle[]}){
 return <div className="space-y-4" aria-label="Monthly investment vehicles">{purposeVehicles(rows).map(group=><section key={group.purpose} className="rounded-xl bg-muted/40 px-3"><div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-3"><h3 className="text-sm font-semibold">{PURPOSE_LABELS[group.purpose]}</h3><span className="tabular text-sm font-semibold">{formatINR(group.total)}/mo</span></div><ul className="divide-y">{group.rows.map(row=><li key={row.key} className="space-y-1 py-3"><div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"><b className="min-w-0 break-words">{row.label}</b><b className="tabular shrink-0">{formatINR(row.total)}/mo</b></div><VehicleCoverage row={row}/></li>)}</ul></section>)}<p className="text-xs text-muted-foreground">Essentials stay separate from other goals. Set up contributions with your provider.</p></div>;
}
