import { formatINR } from "@/lib/format";
import type { MonthlyVehicle } from "@/lib/investment-plan";

export function VehicleCoverage({row}:{row:MonthlyVehicle}){
 return <div className="space-y-1 text-xs text-muted-foreground">
   {row.parts.length>0?<p className="break-words">Covers {row.parts.map(p=>p.goalName).join(", ")}</p>:<p>{row.fixed?"Chosen by you":"Not mapped to a goal yet."}</p>}

 </div>;
}
export function InvestmentVehicles({rows}:{rows:MonthlyVehicle[]}){
 return <ul className="divide-y" aria-label="Monthly investment vehicles">{rows.map(row=><li key={row.key} className="space-y-1 py-3"><div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"><b className="min-w-0 break-words">{row.label}</b><b className="tabular shrink-0">{formatINR(row.total)}/mo</b></div>{row.current>0&&row.extra>0&&<p className="text-xs text-muted-foreground">{formatINR(row.current)} running + {formatINR(row.extra)} to add</p>}<VehicleCoverage row={row}/></li>)}</ul>;
}
