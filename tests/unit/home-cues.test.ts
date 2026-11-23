import { describe,it,expect } from "vitest";
import { missingVehicleCues,homeNextUp,cueCategory } from "@/lib/home-cues";
import { trackGoal,type GoalInput,type Investment } from "@/lib/tracker";
const today="2026-11-21";
const goal=(id:string,targetDate="2027-05-21"):GoalInput=>({id,name:id,type:"custom",target:100000,targetDate,inflationPct:0});
const investment=(category:string,kind="mutual_fund",value=0):Investment=>({id:"holding",name:null,category,kind,value,monthlySip:0,returnPct:0});
const run=(inputs:GoalInput[],investments:Investment[]=[],snoozes:Record<string,unknown>={})=>missingVehicleCues({goals:inputs.map(g=>trackGoal(g,investments,[],today)),investments,links:[],today,snoozes});
describe("Home vehicle setup cues",()=>{
 it("groups short-term purchases into one category cue without naming a scheme",()=>{const cues=run([goal("Phone"),goal("Laptop")]);expect(cues).toHaveLength(1);expect(cues[0].title).toBe("Set up a liquid fund");expect(cues[0].detail).toContain("Laptop and Phone");expect(cues[0].href).toBe("/assets?do=add&category=liquid_fund");});
 it("reuses suitable owned vehicles even before money is added",()=>{expect(run([goal("Phone")],[investment("liquid_fund")])).toEqual([]);expect(run([goal("Phone")],[investment("overnight_fund")])).toEqual([]);});
 it("rejects equity for near-term goals and accepts an available bank account",()=>{expect(run([goal("Phone")],[investment("equity_index")])).toHaveLength(1);expect(run([goal("Phone")],[investment("savings_account","savings")])).toHaveLength(0);});
 it("uses the goal horizon and accepts compatible held categories",()=>{expect(run([goal("Long goal","2036-11-21")])[0].title).toContain("equity index fund");expect(run([goal("Long goal","2036-11-21")],[investment("flexi_cap")])).toEqual([]);expect(run([goal("Soon","2028-11-21")],[investment("arbitrage")])).toEqual([]);});
 it("does not prompt for reached or already on-track goals",()=>{const g=trackGoal(goal("Phone"),[],[],today);expect(missingVehicleCues({goals:[{...g,status:"reached"}],investments:[],links:[],today})).toEqual([]);expect(missingVehicleCues({goals:[{...g,status:"on_track",extraSipNeeded:0}],investments:[],links:[],today})).toEqual([]);});
 it("honours tomorrow snoozes and resurfaces on the passed-in day",()=>{expect(run([goal("Phone")],[],{"vehicle:liquid_fund":"2026-11-22"})).toEqual([]);expect(run([goal("Phone")],[],{"vehicle:liquid_fund":today})).toHaveLength(1);});
 it("keeps a setup cue visible among many routine updates without dropping any",()=>{const updates=[1,2,3,4].map(n=>({key:`bill:${n}`,title:"Log bill",detail:"Update",href:"/cards"}));const cues=run([goal("Phone")]);const result=homeNextUp(updates,cues);expect(result.slice(0,3).map(i=>i.key)).toEqual(["bill:1","vehicle:liquid_fund","bill:2"]);expect(result).toHaveLength(5);});
 it("asks for timing instead of guessing an equity fund for an undated purchase",()=>{expect(run([{...goal("Phone"),targetDate:null}])[0].key).toBe("goal-dates");});
 it("allows only supported category prefills",()=>{expect(cueCategory("liquid_fund")).toBe("liquid_fund");for(const value of [undefined,"other","javascript:bad",{},"elss"])expect(cueCategory(value)).toBeNull();});
});
