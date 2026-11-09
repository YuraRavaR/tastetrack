import { ArrowDownUp, Ellipsis, Link2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { t } from "../i18n/t";
import { MenuSheetContent, menuSheetIconClasses, menuSheetItemClasses } from "./MenuSheetContent";

// The ⋯ by a List's heading (`docs/mockups/collections/`) and every action on the List itself:
// edit it, reorder its films (off under two), share it ("Share Link" once it is shared) and,
// after a divider, delete it. A bottom sheet on a phone, a dropdown from `md`.
export function ListActionsMenu({
  shared,
  reorderable,
  className,
  onEdit,
  onReorder,
  onShare,
  onDelete,
}: {
  shared: boolean;
  // True when the List holds two films or more.
  reorderable: boolean;
  className?: string;
  onEdit: () => void;
  onReorder: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("list.actions")}
          title={t("list.actions")}
          className={cn("size-11 rounded-full", className)}
        >
          <Ellipsis aria-hidden className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <MenuSheetContent open={open} align="end">
        <DropdownMenuItem className={menuSheetItemClasses} onSelect={onEdit}>
          <Pencil aria-hidden className={menuSheetIconClasses} />
          {t("list.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuSheetItemClasses}
          disabled={!reorderable}
          onSelect={onReorder}
        >
          <ArrowDownUp aria-hidden className={menuSheetIconClasses} />
          {t("list.reorder")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuSheetItemClasses} onSelect={onShare}>
          <Link2 aria-hidden className={menuSheetIconClasses} />
          {t(shared ? "list.shareLink" : "list.share")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className={menuSheetItemClasses}
          onSelect={onDelete}
        >
          <Trash2 aria-hidden className={menuSheetIconClasses} />
          {t("list.delete")}
        </DropdownMenuItem>
      </MenuSheetContent>
    </DropdownMenu>
  );
}
