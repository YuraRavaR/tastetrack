import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// What an empty state's one button does: open a page, or act here, as "New collection" does.
// "Add manually" is the one outline button among them.
type EmptyStateAction = { label: string; icon?: LucideIcon; outline?: boolean } & (
  | { to: string }
  | { onClick: () => void }
);

// The one quiet pattern of every empty page or tab: an icon in a circle, one line, a muted `hint`
// under it where one helps, and one button, where there is something to do about it, with an
// outline `secondaryAction` under it where there are two ways in.
export function EmptyState({
  icon: Icon,
  message,
  hint,
  action,
  secondaryAction,
}: {
  icon: LucideIcon;
  message: string;
  hint?: string | undefined;
  action?: EmptyStateAction | undefined;
  secondaryAction?: EmptyStateAction | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-18 pb-10 text-center md:py-24">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-strong md:size-16">
        <Icon aria-hidden className="size-6 md:size-7" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="max-w-75 text-base leading-snug md:max-w-none md:text-lg">{message}</p>
        {hint && (
          <p className="max-w-75 text-muted-foreground text-sm leading-snug md:max-w-none md:text-base">
            {hint}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-col gap-2.5">
          {action && <EmptyStateButton action={action} />}
          {secondaryAction && <EmptyStateButton action={secondaryAction} secondary />}
        </div>
      )}
    </div>
  );
}

function EmptyStateButton({
  action,
  secondary = false,
}: {
  action: EmptyStateAction;
  secondary?: boolean;
}) {
  const ActionIcon = action.icon;
  const content = (
    <>
      {ActionIcon && <ActionIcon aria-hidden />}
      {action.label}
    </>
  );
  const buttonProps = {
    variant: action.outline || secondary ? "outline" : "default",
    className: cn(
      "h-12 px-5.5 font-semibold md:h-11 md:px-5",
      action.outline ? "rounded-full bg-card" : "rounded-xl",
      secondary && "bg-card",
    ),
  } as const;
  return "to" in action ? (
    <Button asChild {...buttonProps}>
      <Link to={action.to}>{content}</Link>
    </Button>
  ) : (
    <Button {...buttonProps} onClick={action.onClick}>
      {content}
    </Button>
  );
}
