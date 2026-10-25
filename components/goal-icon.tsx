import {
  Car,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  type LucideIcon,
  Palmtree,
  Plane,
  Receipt,
  ShieldCheck,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  house_down_payment: Home,
  vehicle: Car,
  education: GraduationCap,
  wedding: Heart,
  travel: Plane,
  retirement: Palmtree,
  emergency_fund: ShieldCheck,
  loan_payoff: Landmark,
  bills_fund: Receipt,
  custom: Target,
};

export function GoalIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? Target;
  return (
    <span
      className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary", className)}
      aria-hidden
    >
      <Icon className="size-5" />
    </span>
  );
}
