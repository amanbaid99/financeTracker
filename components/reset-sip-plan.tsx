"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Sheet} from "./sheet";
import {Button} from "./ui/button";
import {resetSipPlan} from "@/lib/sip-reset-actions";
export function ResetSipPlan(){
 const [open,setOpen]=useState(false),[error,setError]=useState("");const [pending,start]=useTransition();const router=useRouter();
 return <><button type="button" className="min-h-11 text-xs text-muted-foreground underline underline-offset-4" onClick={()=>{setError("");setOpen(true);}}>Reset SIP plan</button>
 {open&&<Sheet title="Reset SIP plan?" onClose={()=>!pending&&setOpen(false)}><div className="space-y-4"><p className="text-sm">Clear your saved monthly allocations and start fresh from your current budget, or enter a new amount. Your budget, goals, investments and provider SIPs stay unchanged.</p>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}<Button variant="destructive" className="w-full" disabled={pending} onClick={()=>start(async()=>{try{const r=await resetSipPlan("RESET_SIP_PLAN");if(!r.ok)return setError(r.error);setOpen(false);router.replace("/goals/sip");router.refresh();}catch{setError("Could not reset. Try again.");}})}>{pending?"Resetting…":"Reset and start fresh"}</Button><Button variant="outline" className="w-full" disabled={pending} onClick={()=>setOpen(false)}>Keep my plan</Button></div></Sheet>}</>;
}
