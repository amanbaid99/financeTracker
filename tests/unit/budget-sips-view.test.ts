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
