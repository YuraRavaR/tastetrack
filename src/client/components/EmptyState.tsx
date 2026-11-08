import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

// The one quiet pattern of every empty page or tab: an icon in a circle, one line and one button.
export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon;
  message: string;
  action: { label: string; to: string; icon?: LucideIcon };
}) {
  const ActionIcon = action.icon;
  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-18 pb-10 text-center md:py-24">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-strong md:size-16">
        <Icon aria-hidden className="size-6 md:size-7" />
      </span>
      <p className="max-w-75 text-base leading-snug md:max-w-none md:text-lg">{message}</p>
      <Button asChild className="h-12 rounded-xl px-5.5 font-semibold md:h-11 md:px-5">
        <Link to={action.to}>
          {ActionIcon && <ActionIcon aria-hidden />}
          {action.label}
        </Link>
      </Button>
    </div>
  );
}
