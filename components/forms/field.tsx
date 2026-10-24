import { InfoTip } from "@/components/ui/info-tip";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  tip,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  tip?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {tip && <InfoTip text={tip} label={`About ${label}`} />}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
