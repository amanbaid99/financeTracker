import { redirect } from "next/navigation";

/** SIPs now live on the Budget page. Old links land there. */
export default function SipPage() {
  redirect("/goals/budget#sips");
}
