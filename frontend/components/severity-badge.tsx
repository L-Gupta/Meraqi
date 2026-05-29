import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { Severity } from "@/lib/schemas/types";

const colors: Record<Severity, string> = {
  Green: "bg-emerald-100 text-emerald-800",
  Amber: "bg-amber-100 text-amber-800",
  Red: "bg-rose-100 text-rose-800",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge className={cn(colors[severity])}>{severity}</Badge>;
}
