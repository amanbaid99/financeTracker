import { z } from "zod";
import { KINDS, KIND_LABELS, asKind, type Kind } from "./instruments";
import { planMoney, type MoneyPlan } from "./allocate";
import type { Investment } from "./tracker";
export const sipMinimumsSchema=z.record(z.string().refine(key=>KINDS.includes(key as Kind)||/^inv:[a-zA-Z0-9_-]+$/.test(key)),z.number().int().min(0).max(1e9)).transform(values=>Object.fromEntries(Object.entries(values).filter(([key])=>key.startsWith("inv:"))));
export type SipMinimums=z.infer<typeof sipMinimumsSchema>;
export const readSipMinimums=(raw:unknown):SipMinimums=>sipMinimumsSchema.safeParse(raw).data??{};
export function heldSipTypes(investments:Investment[]){return KINDS.filter(kind=>investments.some(i=>asKind(i.kind)===kind)).map(kind=>({kind,label:kind==="stock"?"Stocks & ETFs":kind==="mutual_fund"?"Mutual funds":KIND_LABELS[kind]}));}
export function heldSipHoldings(investments:Investment[]){return investments.map(i=>({kind:`inv:${i.id}`,label:i.name?.trim()||KIND_LABELS[asKind(i.kind)],investmentId:i.id}));}
/** Retired category minimums are ignored, including previously saved values. */
export function minimumReservations(minimums:SipMinimums,investments:Investment[]){
 minimums=readSipMinimums(minimums);
 const own=heldSipHoldings(investments).filter(t=>(minimums[t.kind]??0)>0).map(t=>{const current=investments.find(i=>i.id===t.investmentId)!.monthlySip;return {...t,target:minimums[t.kind]!,current,extra:Math.max(0,minimums[t.kind]!-current)};});
 return own;
}
export function planWithMinimums(opts:Parameters<typeof planMoney>[0],minimums:SipMinimums={}):MoneyPlan{
 const reservations=minimumReservations(minimums,opts.investments);
 const reserved=reservations.reduce((sum,r)=>sum+r.extra,0);
 const plan=planMoney({...opts,monthlyTotal:Math.max(0,opts.monthlyTotal-reserved)});
 return {...plan,monthlyTotal:opts.monthlyTotal,monthlyFree:Math.max(0,opts.monthlyTotal-plan.sipsNow),minimums,reservedMonthly:reserved};
}
export function minimumsFit(monthly:number,minimums:SipMinimums,investments:Investment[]){return investments.reduce((s,i)=>s+i.monthlySip,0)+minimumReservations(minimums,investments).reduce((s,r)=>s+r.extra,0)<=monthly;}
export type { Kind };
