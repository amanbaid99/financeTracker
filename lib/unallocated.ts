import { FinancialDecimal as D } from "./funding-math";
import type { Investment,Link } from "./tracker";

/** Named, unassigned ownership, including restricted assets (not necessarily cash). */
export function unallocatedHoldings(investments:Investment[],links:Link[]){
 return investments.map(investment=>{
  const used=links.filter(l=>l.investmentId===investment.id).reduce((sum,l)=>sum.plus(l.percent),new D(0));
  const free=new D(100).minus(used);
  const freePercent=free.greaterThan(0)?free.toNumber():0;
  const value=new D(investment.value).times(freePercent).div(100).toDecimalPlaces(0,D.ROUND_FLOOR).toNumber();
  return {investment,freePercent,value};
 }).filter(r=>r.value>0).sort((a,b)=>b.value-a.value||a.investment.id.localeCompare(b.investment.id));
}

/** Increase just this holding's share in one goal. Never spends other ownership. */
export function assignmentRows(links:Link[],goalId:string,investment:Investment,amount:number){
 const free=unallocatedHoldings([investment],links)[0];
 if(!Number.isSafeInteger(amount)||amount<=0||!free||amount>free.value)throw Error("Choose an amount within this holding's unassigned value.");
 const delta=new D(amount).times(100).div(investment.value).toDecimalPlaces(2,D.ROUND_FLOOR);
 if(!delta.greaterThan(0))throw Error("This amount is too small to assign at the supported share precision.");
 const own=links.filter(l=>l.goalId===goalId);
 const previous=own.find(l=>l.investmentId===investment.id)?.percent??0;
 const percent=new D(previous).plus(delta).toNumber();
 return {rows:[...own.filter(l=>l.investmentId!==investment.id).map(l=>({investmentId:l.investmentId,percent:l.percent})),{investmentId:investment.id,percent}],assigned:delta.times(investment.value).div(100).toDecimalPlaces(0,D.ROUND_FLOOR).toNumber()};
}
