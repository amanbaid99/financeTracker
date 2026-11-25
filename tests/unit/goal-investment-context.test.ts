import {beforeEach,expect,it,vi} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
const state=vi.hoisted(()=>({open:null as unknown,sheet:vi.fn()}));
vi.mock("react",async(importOriginal)=>({...await importOriginal<typeof import("react")>(),useState:()=>[state.open,vi.fn()]}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("@/components/goal-form",()=>({GoalForm:()=>null}));
vi.mock("@/components/quick-add",()=>({QUICK_ACTION:"tracker:quick-action"}));
vi.mock("@/lib/actions",()=>({deleteGoal:vi.fn()}));
vi.mock("@/components/investment-sheet",()=>({InvestmentSheet:(props:unknown)=>{state.sheet(props);return null},investmentTitle:()=>"Savings",investmentSub:()=>"Savings account"}));
import {GoalInvestments} from "@/components/goal-actions";
import {trackGoal} from "@/lib/tracker";
const investment={id:"holding",kind:"savings",name:"Savings",category:"savings_account",value:10000,monthlySip:0,returnPct:0};
const links=[{goalId:"travel",investmentId:"holding",percent:35}];
const goal=trackGoal({id:"travel",name:"Travel",type:"travel",target:60000,targetDate:"2027-11-23",inflationPct:0},[investment],links,"2026-11-23");
beforeEach(()=>vi.clearAllMocks());
it("passes the parent goal when adding an investment, with existing links excluded from the picker",()=>{
 state.open={investment:null,percent:null};
 renderToStaticMarkup(createElement(GoalInvestments,{goal,investments:[investment],links}));
 expect(state.sheet).toHaveBeenCalledWith(expect.objectContaining({goalId:"travel",goalName:"Travel",investment:null,percent:null,linkedIds:["holding"],fromPlan:false}));
});
it("preserves the existing share when opening a goal-linked investment",()=>{
 state.open={investment,percent:35};
 renderToStaticMarkup(createElement(GoalInvestments,{goal,investments:[investment],links}));
 expect(state.sheet).toHaveBeenCalledWith(expect.objectContaining({goalId:"travel",investment,percent:35}));
});
