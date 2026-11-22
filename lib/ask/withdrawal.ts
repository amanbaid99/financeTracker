import { codeAskText } from "./context";
import { parseRupees } from "./amount";
import { formatINR } from "../format";
import { planWithdrawal } from "../withdrawal-plan";
import type { Investment,TrackedGoal } from "../tracker";
export function withdrawalAmount(text:string):number|null {
 if(!/withdraw|redeem|take (?:it |money )?out|come from|pay for|need .* for/i.test(text))return null;
 if(/[-−]\s*(?:₹|rs\.?|inr)?\s*\d/i.test(text))return null;
 const amount=parseRupees(text);
 return amount!==null&&Number.isSafeInteger(amount)&&amount<=1e9?amount:null;
}
export function withdrawalAnswer(opts:{text:string;amount:number;goals:TrackedGoal[];investments:Investment[];today:string;codeOf:Record<string,string>}):string {
 const {text,amount,goals,investments,today,codeOf}=opts;
 const codedText=codeAskText(text,Object.fromEntries(goals.map(g=>[codeOf[g.id],g.name])));
 const matched=goals.filter(g=>!!codeOf[g.id]&&codedText.includes(codeOf[g.id]));
 if(matched.length>1)return "Which single goal is this withdrawal for? Open Plan a withdrawal to choose it and review the impact.";
 const plan=planWithdrawal({amount,goalId:matched[0]?.id,goals,investments,today});
 const lines=[`Withdrawal preview for ${formatINR(amount)}${matched[0]?` for ${codeOf[matched[0].id]}`:""}:`];
 for(const line of plan.lines)lines.push(`- ${formatINR(line.amount)} from ${codeOf[line.investmentId]}, ${line.reason==="unassigned"?"not needed by a goal today":"currently covering the selected goal"}.`);
 if(plan.short>0)lines.push(`${formatINR(plan.short)} is still needed. Other goals, emergency reserves and bill reserves are protected. Choose the purpose in Plan a withdrawal; considering other goals requires your explicit choice there.`);
 for(const impact of plan.impacts)lines.push(`- ${codeOf[impact.goalId]} would need ${formatINR(impact.extraShortfall)} more funding at its goal date.`);
 if(!plan.impacts.length&&plan.available>0)lines.push("No additional funding shortfall in the current goal model.");
 lines.push("This uses recorded balances with goal targets unchanged. Completing a goal is a separate update. Tax, exit loads, settlement and purchase-lot restrictions are not calculated. ELSS, retirement accounts, FDs, physical gold and unknown assets are excluded. Check access with your provider. Nothing is withdrawn or saved.");
 return lines.join("\n\n");
}
