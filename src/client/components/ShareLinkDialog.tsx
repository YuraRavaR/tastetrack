import { Check, Copy, Link2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { List } from "../../shared/api";
import * as api from "../api";
import { type MessageId, t } from "../i18n/t";
import { FormError } from "./FormError";
import {
  SheetHeader,
  sheetBodyClasses,
  sheetClasses,
  sheetMainButtonClasses,
  sheetSafeBottomClasses,
} from "./sheet";

interface ShareLinkAction {
  button: MessageId;
  title: MessageId;
  description: MessageId;
  confirm: MessageId;
  variant: "default" | "destructive";
  run: (listId: number) => Promise<unknown>;
}

// What replacing the link or stopping sharing says and does, each asked about first.
const actions = {
  regenerate: {
    button: "share.regenerate",
    title: "share.regenerateTitle",
    description: "share.regenerateDescription",
    confirm: "share.regenerateConfirm",
    variant: "default",
    run: api.regenerateShareLink,
  },
  revoke: {
    button: "share.revoke",
    title: "share.revokeTitle",
    description: "share.revokeDescription",
    confirm: "share.revokeConfirm",
    variant: "destructive",
    run: api.revokeShareLink,
  },
} as const satisfies Record<string, ShareLinkAction>;

type Action = keyof typeof actions;

// The row of New link and Stop sharing, and of a question's answers: two halves on a phone, on
// the right from `md`, with smaller buttons than the sheet's main ones.
const buttonRowClasses = "grid grid-cols-2 gap-2.5 md:flex md:justify-end";
const smallButtonClasses = "h-11 md:h-9";

type SharedList = Pick<List, "id" | "name" | "shareLink">;

// Sharing one of the User's Lists (`docs/mockups/collections/`, `#share`): a button that makes a
// Share Link, and once there is one, the link to copy and buttons to replace it or stop sharing.
// Each of those asks first, inside the dialog, since anyone holding the old link loses it. After
// each change `onChanged` reloads the List, so the link shown is always the Worker's, on the app's
// own origin. A bottom sheet on a phone, a centred dialog from `md`. The dialog unmounts its sheet
// once closed, so each opening starts afresh.
export function ShareLinkDialog({
  open,
  list,
  onClose,
  onChanged,
}: {
  open: boolean;
  list: SharedList;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className={cn(sheetClasses, "md:max-w-[520px]")}>
        <ShareLinkSheet list={list} onChanged={onChanged} />
      </DialogContent>
    </Dialog>
  );
}

function ShareLinkSheet({ list, onChanged }: { list: SharedList; onChanged: () => Promise<void> }) {
  const { shareLink } = list;
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<Action | null>(null);
  const ids = useId();
  const input = useRef<HTMLInputElement>(null);
  const shareButton = useRef<HTMLButtonElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const actionButtons = useRef<Partial<Record<Action, HTMLButtonElement | null>>>({});
  // A question takes the place of the button that asked it, so once it closes, focus goes to the
  // button this finds after the next render.
  const focusAfterQuestion = useRef<(() => HTMLElement | null | undefined) | null>(null);

  useEffect(() => {
    const target = focusAfterQuestion.current?.();
    focusAfterQuestion.current = null;
    target?.focus();
  });

  // Makes, replaces or stops the link, then reloads the List.
  async function changeSharing(request: () => Promise<unknown>) {
    setWorking(true);
    setFailed(false);
    const changed = await request();
    if (changed) await onChanged();
    setWorking(false);
    if (!changed) return setFailed(true);
    focusAfterQuestion.current = () => copyButton.current ?? shareButton.current;
    setConfirming(null);
    setCopied(false);
  }

  function ask(action: Action) {
    setFailed(false);
    setConfirming(action);
  }

  function cancel(action: Action) {
    focusAfterQuestion.current = () => actionButtons.current[action];
    setFailed(false);
    setConfirming(null);
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Without clipboard access, the link is selected for the User to copy themselves.
      input.current?.select();
    }
  }

  const failure = failed && <FormError>{t("share.failed")}</FormError>;

  return (
    <>
      <SheetHeader
        title={shareLink ? t("share.title") : t("share.dialogTitle", { list: list.name })}
        description={t("share.explanation")}
      />
      <div className={cn(sheetBodyClasses, sheetSafeBottomClasses, "md:pb-6")}>
        {!shareLink && (
          <>
            {failure}
            <Button
              ref={shareButton}
              className={sheetMainButtonClasses}
              disabled={working}
              onClick={() => changeSharing(() => api.createShareLink(list.id))}
            >
              <Link2 aria-hidden />
              {t(working ? "share.sharing" : "share.share")}
            </Button>
          </>
        )}
        {shareLink && confirming && (
          <Confirmation
            id={ids}
            action={confirming}
            working={working}
            failure={failure}
            onCancel={() => cancel(confirming)}
            onConfirm={() => changeSharing(() => actions[confirming].run(list.id))}
          />
        )}
        {shareLink && !confirming && (
          <>
            <div className="flex flex-col gap-2.5 md:flex-row">
              <label htmlFor={`${ids}-link`} className="sr-only">
                {t("share.linkLabel")}
              </label>
              <Input
                ref={input}
                id={`${ids}-link`}
                readOnly
                value={shareLink.url}
                onFocus={(event) => event.currentTarget.select()}
                className="h-11 md:h-10"
              />
              <Button
                ref={copyButton}
                className={cn(sheetMainButtonClasses, "shrink-0")}
                onClick={() => copy(shareLink.url)}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {t(copied ? "share.copied" : "share.copy")}
              </Button>
            </div>
            {failure}
            <div className={buttonRowClasses}>
              {(Object.keys(actions) as Action[]).map((action) => (
                <Button
                  key={action}
                  ref={(button) => {
                    actionButtons.current[action] = button;
                  }}
                  variant="outline"
                  className={cn(
                    smallButtonClasses,
                    actions[action].variant === "destructive" &&
                      "text-destructive hover:text-destructive",
                  )}
                  onClick={() => ask(action)}
                >
                  {t(actions[action].button)}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// The question before the link is replaced or stopped, in place of the link while it is asked.
function Confirmation({
  id,
  action,
  working,
  failure,
  onCancel,
  onConfirm,
}: {
  id: string;
  action: Action;
  working: boolean;
  failure: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const chosen = actions[action];
  return (
    <div
      role="alertdialog"
      aria-labelledby={`${id}-question`}
      aria-describedby={`${id}-answer`}
      className="flex flex-col gap-2.5 rounded-xl bg-muted p-3.5 md:p-4"
    >
      <p id={`${id}-question`} className="font-bold text-[15px]">
        {t(chosen.title)}
      </p>
      <p id={`${id}-answer`} className="text-sm leading-normal">
        {t(chosen.description)}
      </p>
      {failure}
      <div className={buttonRowClasses}>
        <Button variant="outline" autoFocus className={smallButtonClasses} onClick={onCancel}>
          {t("share.cancel")}
        </Button>
        <Button
          variant={chosen.variant}
          disabled={working}
          className={cn(smallButtonClasses, "font-semibold")}
          onClick={onConfirm}
        >
          {t(working ? "share.saving" : chosen.confirm)}
        </Button>
      </div>
    </div>
  );
}
