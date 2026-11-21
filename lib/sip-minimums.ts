import { z } from "zod";
import { KINDS, KIND_LABELS, asKind, type Kind } from "./instruments";
import { planMoney, type MoneyPlan } from "./allocate";
import type { Investment } from "./tracker";
export const sipMinimumsSchema=z.partialRecord(z.enum(KINDS),z.number().int().min(0).max(1e9));
export type SipMinimums=z.infer<typeof sipMinimumsSchema>;
export const readSipMinimums=(raw:unknown):SipMinimums=>sipMinimumsSchema.safeParse(raw).data??{};
export function heldSipTypes(investments:Investment[]){return KINDS.filter(kind=>investments.some(i=>asKind(i.kind)===kind)).map(kind=>({kind,label:kind==="stock"?"Stocks & ETFs":kind==="mutual_fund"?"Mutual funds":KIND_LABELS[kind]}));}
export function minimumReservations(minimums:SipMinimums,investments:Investment[]){
 return heldSipTypes(investments).filter(t=>(minimums[t.kind]??0)>0).map(t=>{const current=investments.filter(i=>asKind(i.kind)===t.kind).reduce((s,i)=>s+i.monthlySip,0);return {...t,target:minimums[t.kind]!,current,extra:Math.max(0,minimums[t.kind]!-current)};});
}
export function planWithMinimums(opts:Parameters<typeof planMoney>[0],minimums:SipMinimums={}):MoneyPlan{
 const reservations=minimumReservations(minimums,opts.investments);
 const reserved=reservations.reduce((sum,r)=>sum+r.extra,0);
 const plan=planMoney({...opts,monthlyTotal:Math.max(0,opts.monthlyTotal-reserved)});
 return {...plan,monthlyTotal:opts.monthlyTotal,monthlyFree:Math.max(0,opts.monthlyTotal-plan.sipsNow),minimums,reservedMonthly:reserved};
}
export function minimumsFit(monthly:number,minimums:SipMinimums,investments:Investment[]){return investments.reduce((s,i)=>s+i.monthlySip,0)+minimumReservations(minimums,investments).reduce((s,r)=>s+r.extra,0)<=monthly;}
export type { Kind };
