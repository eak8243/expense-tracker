import { cn } from "@/lib/utils";
import { Clock, FileCheck, CheckCircle2 } from "lucide-react";

const STATUS_CONFIG = {
  draft: {
    label: "ร่าง",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    icon: Clock,
  },
  claimed: {
    label: "ทำเบิกแล้ว",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    icon: FileCheck,
  },
  reimbursed: {
    label: "ได้เงินแล้ว",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
} as const;

type Status = keyof typeof STATUS_CONFIG;

interface StatusBadgeProps {
  status: Status | string;
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ status, showIcon = true, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as Status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-800 border-gray-200",
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  );
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "ร่าง",
  claimed: "ทำเบิกแล้ว",
  reimbursed: "ได้เงินแล้ว",
};

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  normal_expense: "ค่าใช้จ่ายทั่วไป",
  iou_advance: "เงินทดรองจ่าย",
};
