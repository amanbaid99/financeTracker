"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayIST } from "@/lib/dates";

/** Refresh date-sensitive views after midnight or returning to the app. */
export function useDayRefresh(today:string){
 const router=useRouter();
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==="visible"&&todayIST()!==today)router.refresh();};
  refresh();document.addEventListener("visibilitychange",refresh);window.addEventListener("focus",refresh);
  return()=>{document.removeEventListener("visibilitychange",refresh);window.removeEventListener("focus",refresh);};
 },[today,router]);
}
