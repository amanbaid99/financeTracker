// A monthly plan grouped by vehicle, with existing contributions counted once.
import { minimumReservations } from "./sip-minimums";
import { asKind } from "./instruments";
import type { MoneyPlan } from "./allocate";
import { categoryLabel } from "./categories";
import { sipPlan } from "./sip-plan";
import type { Investment, Link, TrackedGoal } from "./tracker";

export interface VehiclePart { goalId:string; goalName:string; monthly:number; until:string|null }
export interface MonthlyVehicle {
  fixed?:boolean; key:string; label:string; current:number; extra:number; total:number; parts:VehiclePart[];
}
export function monthlyVehicles(plan:MoneyPlan, investments:Investment[], links:Link[], goals:TrackedGoal[]):MonthlyVehicle[] {
  const rows = new Map<string,MonthlyVehicle>();
  for (const inv of investments.filter(i=>i.monthlySip>0)) {
    const total=inv.monthlySip;
    const parts:VehiclePart[]=[];
    let left=total;
    for (const link of links.filter(l=>l.investmentId===inv.id)) {
      const g=goals.find(g=>g.id===link.goalId);
      const monthly=Math.min(left,Math.round(total*link.percent/100));
      if(g&&monthly>0){parts.push({goalId:g.id,goalName:g.name,monthly,until:g.targetDate});left-=monthly;}
    }
    rows.set(`inv:${inv.id}`,{key:`inv:${inv.id}`,label:inv.name?.trim()||categoryLabel(inv.category),current:total,extra:0,total,parts});
  }
  for(const line of sipPlan(plan.suggestions,investments,links,"pooled")){
    const key=line.investment?`inv:${line.investment.id}`:`new:${line.category}`;
    const row=rows.get(key)??{key,label:line.label,current:0,extra:0,total:0,parts:[]};
    row.extra+=line.monthly;row.total+=line.monthly;
    for(const part of line.parts){const old=row.parts.find(p=>p.goalId===part.goalId);if(old)old.monthly+=part.monthly;else row.parts.push({...part});}
    rows.set(key,row);
  }
  for(const reserved of minimumReservations(plan.minimums??{},investments)){
    if(reserved.extra===0)continue; // Already fulfilled by the named running holdings.
    const partRows=[...rows.values()].filter(r=>investments.some(i=>r.key===`inv:${i.id}`&&asKind(i.kind)===reserved.kind));
    // Existing contributions within a chosen type count once. Keep generated
    // recommendations separate so they remain visibly editable through the budget.
    let current=0;
    for(const row of partRows){current+=row.current;row.total-=row.current;row.current=0;if(row.total===0)rows.delete(row.key);}
    rows.set(`fixed:${reserved.kind}`,{key:`fixed:${reserved.kind}`,label:reserved.label,current,extra:reserved.extra,total:current+reserved.extra,parts:[],fixed:true});
  }
  return [...rows.values()].sort((a,b)=>b.total-a.total||a.key.localeCompare(b.key));
}
