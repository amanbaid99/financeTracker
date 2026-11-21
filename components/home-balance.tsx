import Link from "next/link";
import { ChevronRight,Coins } from "lucide-react";
import { signedINR } from "@/components/net-worth-card";
import { formatINRCompact } from "@/lib/format";

/** One balance hierarchy and one optional action, with no duplicate holdings link. */
export function HomeBalance({assets,liabilities}:{assets:number;liabilities:number}){
 return <section aria-label="Your money" data-guide="net-worth" className="overflow-hidden rounded-2xl border border-primary/15 bg-card">
  <Link href="/assets" className="press block space-y-4 p-5" aria-label="View net worth and holdings">
   <div className="flex items-center justify-between text-sm text-muted-foreground"><h2>Net worth</h2><ChevronRight className="size-4" aria-hidden /></div>
   <p className="tabular break-words text-4xl font-semibold tracking-tight">{signedINR(assets-liabilities)}</p>
   <dl className="grid grid-cols-2 gap-4 text-xs"><div className="space-y-1"><dt className="text-muted-foreground">Assets</dt><dd className="tabular text-sm font-medium">{formatINRCompact(assets)}</dd></div><div className="space-y-1"><dt className="text-muted-foreground">Loans outstanding</dt><dd className="tabular text-sm font-medium">{formatINRCompact(liabilities)}</dd></div></dl>
  </Link>
  <Link href="/goals?do=extra" className="press flex min-h-12 items-center gap-2 border-t border-border/60 px-5 text-sm font-medium text-primary"><Coins className="size-4 shrink-0" aria-hidden /><span className="flex-1">I have extra money</span><ChevronRight className="size-4" aria-hidden /></Link>
 </section>;
}
