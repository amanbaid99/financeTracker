import type { SipRow } from "./budget-sips";
export type VehicleAmounts = Record<string, number>;
/** Exact whole-rupee apportionment, with stable ID tie-breaking. */
function apportion(total:number,weights:VehicleAmounts):VehicleAmounts{
 const entries=Object.entries(weights).sort(([a],[b])=>a.localeCompare(b));
 const sum=entries.reduce((s,[,n])=>s+BigInt(n),BigInt(0));
 if(!sum)return Object.fromEntries(entries.map(([id])=>[id,0]));
 const parts=entries.map(([id,n])=>({id,n:Number(BigInt(total)*BigInt(n)/sum),remainder:BigInt(total)*BigInt(n)%sum}));
 let left=total-parts.reduce((s,p)=>s+p.n,0);
 const order=[...parts].sort((a,b)=>a.remainder===b.remainder?a.id.localeCompare(b.id):a.remainder>b.remainder?-1:1);
 for(const p of order){if(!left)break;p.n++;left--;}
 return Object.fromEntries(parts.map(p=>[p.id,p.n]));
}
export function scaleVehicleAmounts(pins:VehicleAmounts,oldTotal:number,newTotal:number):VehicleAmounts{
 if(oldTotal===newTotal)return {...pins};
 if(oldTotal<=0)return Object.fromEntries(Object.keys(pins).map(id=>[id,0]));
 const auto=Math.max(0,oldTotal-Object.values(pins).reduce((s,n)=>s+n,0));
 const scaled=apportion(newTotal,{...pins,auto});
 return Object.fromEntries(Object.keys(pins).map(id=>[id,scaled[id]??0]));
}
export function goalVehicleAmounts(rows:SipRow[],goalId:string,total:number):VehicleAmounts{
 const own=rows.filter(r=>r.goalId===goalId);
 const pins:VehicleAmounts={};
 for(const row of own)for(const [id,n] of Object.entries(row.vehicleAmounts??{}))pins[id]=(pins[id]??0)+n;
 return scaleVehicleAmounts(pins,own.reduce((s,r)=>s+r.amount,0),total);
}
export function vehicleSplit(total:number,ids:string[],pins:VehicleAmounts={}){
 const unique=[...new Set(ids)].sort();
 const invalid=!Number.isSafeInteger(total)||total<0||Object.values(pins).some(n=>!Number.isSafeInteger(n)||n<0);
 if(invalid)return {amounts:Object.fromEntries(unique.map(id=>[id,0])),error:"Use non-negative whole-rupee amounts."};
 const stale=Object.keys(pins).some(id=>!unique.includes(id));
 const chosen=Object.entries(pins).filter(([id])=>unique.includes(id));
 const fixed=chosen.reduce((s,[,n])=>s+n,0),free=unique.filter(id=>!Object.hasOwn(pins,id));
 const error=invalid?"Use non-negative whole-rupee amounts.":stale?"An investment in this split changed. Review and save the split.":fixed>total?"Chosen amounts exceed this goal’s monthly total.":!free.length&&fixed!==total?"Your amounts must add up to the goal’s monthly total.":null;
 const remaining=Math.max(0,total-fixed);
 const automatic=apportion(remaining,Object.fromEntries(free.map(id=>[id,1])));
 return {amounts:Object.fromEntries(unique.map(id=>[id,Object.hasOwn(pins,id)?pins[id]:automatic[id]??0])),error};
}

/** Replace only this goal's plan row; all other goals retain their exact rows. */
export function withGoalVehicleAmounts(rows:SipRow[],goalId:string,label:string,pins:VehicleAmounts):SipRow[]{
 const own=rows.filter(r=>r.goalId===goalId),total=own.reduce((s,r)=>s+r.amount,0);
 if(!own.length)return rows.map(r=>({...r}));
 const replacement:SipRow={...own[0],investmentId:null,amount:total,label:label.slice(0,80),vehicleAmounts:{...pins}};
 let added=false;
 return rows.flatMap(r=>{if(r.goalId!==goalId)return [{...r}];if(added)return [];added=true;return [replacement];});
}
