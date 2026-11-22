import { categoryForHorizon, type Suggestion } from "./allocate";
import { categoryLabel } from "./categories";
import { orderGoals } from "./goal-order";
import { sipPlan } from "./sip-plan";
import type { Investment,Link,TrackedGoal } from "./tracker";
import type { UpdateDue } from "./updates";
export const HOME_VEHICLE_CATEGORIES=["liquid_fund","short_debt_fund","balanced_advantage","equity_index"] as const;
export function cueCategory(value:unknown):string|null{return typeof value==="string"&&(HOME_VEHICLE_CATEGORIES as readonly string[]).includes(value)?value:null;}
/** One category cue for all goals that need it, never a new account per goal. */
export function missingVehicleCues({goals,investments,links,today,snoozes={}}:{goals:TrackedGoal[];investments:Investment[];links:Link[];today:string;snoozes?:Record<string,unknown>}):UpdateDue[]{
 const grouped=new Map<string,string[]>();
 const needs:Suggestion[]=goals.map(goal=>({goalId:goal.id,goalName:goal.name,monthly:1,lump:0,...categoryForHorizon(goal.months,goal.type),categoryLabel:categoryLabel(categoryForHorizon(goal.months,goal.type).category),after:goal,stage:"ranked" as const}));
 const vehicles=sipPlan(needs,investments,links,"pooled",goals);
 for(const goal of orderGoals(goals,today)){
  if(goal.status==="reached"||goal.emisCloseFirst)continue;
  if(goal.status==="on_track"&&goal.extraSipNeeded<=0&&!goal.billsFund?.short)continue;
  if(goal.months===null&&!["emergency_fund","bills_fund","retirement"].includes(goal.type)){
    grouped.set("needs-date",[...(grouped.get("needs-date")??[]),goal.name]);continue;
  }
  const {category}=categoryForHorizon(goal.months,goal.type);
  if(vehicles.some(v=>v.investment&&v.parts.some(p=>p.goalId===goal.id)))continue;
  grouped.set(category,[...(grouped.get(category)??[]),goal.name]);
 }
 return [...grouped].map(([category,names])=>category==="needs-date"?{key:"goal-dates",title:"Add dates to plan your goals",detail:`For ${names.slice(0,2).join(" and ")}${names.length>2?` and ${names.length-2} more goals`:""}. Knowing when helps choose a suitable vehicle.`,href:"/goals",actionLabel:"Review goals"}:({key:`vehicle:${category}`,title:`Set up ${category==="equity_index"?"an":"a"} ${categoryLabel(category).toLowerCase()}`,detail:`For ${names.slice(0,2).join(" and ")}${names.length>2?` and ${names.length-2} more goals`:""}. Choose one with your provider, then record it here.`,href:`/assets?do=add&category=${encodeURIComponent(category)}`,actionLabel:"Record fund"})).filter(item=>typeof snoozes[item.key]!=="string"||(snoozes[item.key] as string)<=today);
}
/** Keep a setup cue visible even when there are several routine updates. */
export function homeNextUp(updates:UpdateDue[],cues:UpdateDue[]):UpdateDue[]{
 const ordered=[...updates.slice(0,1),...cues.slice(0,1),...updates.slice(1),...cues.slice(1)];
 return ordered.filter((item,index)=>ordered.findIndex(other=>other.key===item.key)===index);
}
