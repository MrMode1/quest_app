import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-slate-100 text-slate-600 border-slate-200" },
  processing: {
    label: "Processing",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  reviewed: { label: "Reviewed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  error: { label: "Error", className: "bg-red-100 text-red-700 border-red-200" },
  exported: { label: "Exported", className: "bg-blue-100 text-blue-700 border-blue-200" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      {status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
      {style.label}
    </span>
  );
}
