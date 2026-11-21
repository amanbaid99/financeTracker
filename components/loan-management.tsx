"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/sheet";
import Link from "next/link";
import { manageLoan } from "@/lib/loan-management-actions";
import type { Loan } from "@/lib/loans";

export function LoanManagement({loan,closed=false}:{loan:Loan;closed?:boolean}){
 const [open,setOpen]=useState(false),[action,setAction]=useState<"close"|"delete"|null>(null),[error,setError]=useState("");const[pending,start]=useTransition();const router=useRouter();
 return <><Button variant="ghost" size="sm" className="min-h-10 text-primary" onClick={()=>{setOpen(true);setAction(null);setError("");}} aria-label={`Manage ${loan.name}`}>Manage loan</Button>
 {open&&<Sheet title={loan.name} onClose={()=>{if(!pending)setOpen(false);}}><div className="space-y-4">
 {!action?<><p className="text-sm text-muted-foreground">{closed?"This loan is closed. It is excluded from what you owe and future EMIs.":"Update this loan even if its payoff goal has been deleted."}</p><Link href={`/updates?loan=${encodeURIComponent(loan.id)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border text-sm font-medium">Update loan balance</Link>{!closed&&<><Button variant="outline" className="w-full" onClick={()=>setAction("close")}>Mark closed / foreclosed</Button></>}<Button variant="ghost" className="w-full text-danger" onClick={()=>setAction("delete")}>Delete loan</Button></>:<>
 <p className="text-sm">{action==="close"?"Confirm that this loan is fully repaid or foreclosed. Its outstanding balance will be set to ₹0. It will leave your active loans and EMI reminders, while its history stays.":"Permanently delete this loan and its recorded EMI payment history? This cannot be undone. Your investments will not be deleted."}</p>
 {loan.goal&&action==="delete"&&<p className="text-sm text-muted-foreground">A payoff goal is still linked. Marking the loan closed keeps that history. Delete the payoff goal first if you want to permanently remove the loan.</p>}
 {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
 <Button variant={action==="delete"?"destructive":"default"} className="w-full" disabled={pending||(action==="delete"&&!!loan.goal)} onClick={()=>start(async()=>{setError("");try{const result=await manageLoan({id:loan.id,confirmation:action==="close"?"CLOSE_LOAN":"DELETE_LOAN"});if(!result.ok){setError(result.error);return;}setOpen(false);router.refresh();}catch{setError("Could not update the loan. Try again.");}})}>{pending?"Saving…":action==="close"?"Confirm loan is closed":"Permanently delete loan"}</Button>
 <Button variant="outline" className="w-full" disabled={pending} onClick={()=>{setAction(null);setError("");}}>Cancel</Button>
 </>}
 </div></Sheet>}
 </>;
}
