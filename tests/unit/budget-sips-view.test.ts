import {expect,it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {BudgetSips} from "@/components/budget-sips";
it("shows the saved allocation and remaining amount before goals, with an explicit edit action",()=>{
 const html=renderToStaticMarkup(createElement(BudgetSips,{rows:[{id:"a",label:"Travel",goalId:"a",investmentId:null,amount:71000}],budgetMonthly:91985,goals:[{id:"a",label:"Travel"}],pending:false,error:"",onSave:()=>{throw Error("No save on render");}}));expect(html).toContain("₹20,985 remaining");expect(html.indexOf("remaining")).toBeLessThan(html.indexOf("Travel</p>"));expect(html).toContain("Edit SIPs");expect(html).not.toContain("<input");expect(html).not.toContain("Save SIPs");
});
it("keeps the summary consistent with visible active goals when old rows remain",()=>{
 const html=renderToStaticMarkup(createElement(BudgetSips,{rows:[{id:"active",label:"Travel",goalId:"a",investmentId:null,amount:1000},{id:"old",label:"Old goal",goalId:"deleted",investmentId:null,amount:5000}],budgetMonthly:10000,goals:[{id:"a",label:"Travel"}],pending:false,error:"",onSave:()=>{}}));expect(html).toContain("₹1,000 of ₹10,000");expect(html).toContain("₹9,000 remaining");expect(html).not.toContain("₹6,000");
});
it("shows custom saved fund amounts and a split action without inline inputs",()=>{
 const a="00000000-0000-4000-8000-000000000001",b="00000000-0000-4000-8000-000000000002",c="00000000-0000-4000-8000-000000000003";
 const html=renderToStaticMarkup(createElement(BudgetSips,{rows:[{id:"ret",label:"Retirement",goalId:"ret",investmentId:null,amount:6000,vehicleAmounts:{[a]:500}}],budgetMonthly:6000,goals:[{id:"ret",label:"Retirement",vehicles:[{id:a,label:"Retirement account",assetClass:"retirement"},{id:b,label:"Stock holding",assetClass:"equity"},{id:c,label:"Index holding",assetClass:"equity"}]}],pending:false,error:"",onSave:()=>{throw Error("No save on render");}}));
 expect(html).toContain("₹500");expect(html.match(/₹2,750/g)).toHaveLength(2);expect(html).toContain("Adjust split");expect(html).not.toContain("<input");
});
