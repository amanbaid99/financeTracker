import {expect,it} from "vitest";
import {cardStrategy} from "@/lib/card-strategy";
import {emptyBenefits,readCardBenefits} from "@/lib/card-benefits";
import type {Card} from "@/lib/cards";
const card:Card={id:"card",label:"My card",annualFee:null,yearStart:null,rewards:null,benefits:[],bestFor:[],bills:[],milestones:[]};
it("does not invent strategy for names without confirmed terms",()=>{
 expect(cardStrategy({...card,label:"SBI PhonePe"})).toEqual({useFor:"",remember:""});
 expect(cardStrategy(card)).toEqual({useFor:"",remember:""});
});
it("retains personal edits and intentional hiding through the saved-benefit reader",()=>{
 const features=readCardBenefits({...emptyBenefits(),version:1,reviewedAt:"2026-11-25T00:00:00Z",strategy:{useFor:"My groceries",remember:"Use my preferred card"}})!;
 expect(cardStrategy({...card,featureDetails:features})).toEqual(features.strategy);
 features.strategy={useFor:"",remember:""};
 expect(cardStrategy({...card,featureDetails:features})).toEqual({useFor:"",remember:""});
});
