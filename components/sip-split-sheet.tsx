"use client";
import {useState} from "react";
import {Sheet} from "./sheet";
import {MoneyInput} from "./money-input";
import {SheetActions} from "./forms/sheet-actions";
import {formatINR} from "@/lib/format";
import {vehicleSplit,type VehicleAmounts} from "@/lib/sip-vehicle-split";
export function SipSplitSheet({name,total,vehicles,saved,pending,error,onClose,onSave}:{name:string;total:number;vehicles:{id:string;label:string}[];saved:VehicleAmounts;pending:boolean;error:string;onClose:()=>void;onSave:(pins:VehicleAmounts)=>void}){
 const [pins,setPins]=useState<VehicleAmounts>(()=>Object.fromEntries(Object.entries(saved).filter(([id])=>vehicles.some(v=>v.id===id))));
 const ids=vehicles.map(v=>v.id),split=vehicleSplit(total,ids,pins);
 const [drafts,setDrafts]=useState<Record<string,number|null>>({});
 const changed=JSON.stringify(Object.entries(pins).sort())!==JSON.stringify(Object.entries(saved).sort());
 return <Sheet title={`Adjust ${name} split`} onClose={()=>!pending&&onClose()}><div className="space-y-4">
  <div className="rounded-xl bg-primary/5 p-4"><p className="text-xs text-muted-foreground">{name} monthly total</p><p className="tabular mt-1 text-2xl font-semibold">{formatINR(total)}</p></div>
  <p className="text-xs text-muted-foreground">Amounts you change stay fixed. The other funds share what remains. Blank means ₹0.</p>
  <fieldset disabled={pending} className="min-w-0 divide-y">{vehicles.map(v=><div key={v.id} className="flex items-center justify-between gap-3 py-3"><label htmlFor={`split-${v.id}`} className="min-w-0 break-words text-sm">{v.label}</label><div className="w-32 shrink-0"><MoneyInput id={`split-${v.id}`} aria-label={`${v.label} split a month`} value={Object.hasOwn(drafts,v.id)?drafts[v.id]:split.amounts[v.id]??0} onChange={n=>{setDrafts(old=>({...old,[v.id]:n}));setPins(old=>({...old,[v.id]:n??0}));}}/></div></div>)}</fieldset>
  {(split.error||error)&&<p role="alert" className="text-sm text-danger">{split.error||error}</p>}
  <SheetActions pending={pending} disabled={!!split.error||!changed} label="Save split" onCancel={onClose} onSave={()=>onSave(pins)}/>
 </div></Sheet>;
}
