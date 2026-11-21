import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { signedINR } from "@/components/net-worth-card";
import { formatINRCompact } from "@/lib/format";

/** One balance hierarchy linked directly to holdings. */
export function HomeBalance({assets,liabilities}:{assets:number;liabilities:number}){
 return <section aria-label="Your money" data-guide="net-worth" className="overflow-hidden rounded-2xl border border-primary/15 bg-card">
  <Link href="/assets" className="press block space-y-4 p-5" aria-label="View net worth and holdings">
   <div className="flex items-center justify-between text-sm text-muted-foreground"><h2>Net worth</h2><ChevronRight className="size-4" aria-hidden /></div>
   <p className="tabular break-words text-4xl font-semibold tracking-tight">{signedINR(assets-liabilities)}</p>
   <dl className="grid grid-cols-2 gap-4 text-xs"><div className="space-y-1"><dt className="text-muted-foreground">Assets</dt><dd className="tabular text-sm font-medium">{formatINRCompact(assets)}</dd></div><div className="space-y-1"><dt className="text-muted-foreground">Loans outstanding</dt><dd className="tabular text-sm font-medium">{formatINRCompact(liabilities)}</dd></div></dl>
  </Link>

 </section>;
}
