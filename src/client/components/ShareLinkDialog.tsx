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
import { SheetHeader, sheetBodyClasses, sheetButtonClasses, sheetClasses } from "./sheet";

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

type SharedList = Pick<List, "id" | "name" | "shareLink">;

// Sharing one of the User's Lists (`docs/mockups/collections/`, `#share`): a button that makes a
// Share Link, and once there is one, the link to copy and buttons to replace it or stop sharing.
// Each of those asks first, inside the dialog, since anyone holding the old link loses it. After
// each change `onChanged` reloads the List, so the link shown is always the Worker's, on the app's
// own origin. A bottom sheet on a phone, a centred dialog from `md`.
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
        {open && <ShareLinkSheet list={list} onChanged={onChanged} />}
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
  // The buttons that had focus go while a question is asked, so where focus goes once it closes.
  const refocus = useRef<(() => HTMLElement | null | undefined) | null>(null);

  useEffect(() => {
    const target = refocus.current?.();
    refocus.current = null;
    target?.focus();
  });

  async function change(run: () => Promise<unknown>) {
    setWorking(true);
    setFailed(false);
    const done = await run();
    if (done) await onChanged();
    setWorking(false);
    if (!done) return setFailed(true);
    refocus.current = () => copyButton.current ?? shareButton.current;
    setConfirming(null);
    setCopied(false);
  }

  function ask(action: Action) {
    setFailed(false);
    setConfirming(action);
  }

  function cancel(action: Action) {
    refocus.current = () => actionButtons.current[action];
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
      <div
        className={cn(
          sheetBodyClasses,
          "pb-[calc(0.75rem+max(1.375rem,env(safe-area-inset-bottom)))] md:pb-6",
        )}
      >
        {!shareLink && (
          <>
            {failure}
            <Button
              ref={shareButton}
              className={cn(sheetButtonClasses, "font-semibold")}
              disabled={working}
              onClick={() => change(() => api.createShareLink(list.id))}
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
            onConfirm={() => change(() => actions[confirming].run(list.id))}
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
                className={cn(sheetButtonClasses, "shrink-0 font-semibold")}
                onClick={() => copy(shareLink.url)}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {t(copied ? "share.copied" : "share.copy")}
              </Button>
            </div>
            {failure}
            <div className="grid grid-cols-2 gap-2.5 md:flex md:justify-end">
              {(Object.keys(actions) as Action[]).map((each) => (
                <Button
                  key={each}
                  ref={(button) => {
                    actionButtons.current[each] = button;
                  }}
                  variant="outline"
                  className={cn(
                    "h-11 md:h-9",
                    actions[each].variant === "destructive" &&
                      "text-destructive hover:text-destructive",
                  )}
                  onClick={() => ask(each)}
                >
                  {t(actions[each].button)}
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
      <div className="grid grid-cols-2 gap-2.5 md:flex md:justify-end">
        <Button variant="outline" autoFocus className="h-11 md:h-9" onClick={onCancel}>
          {t("share.cancel")}
        </Button>
        <Button
          variant={chosen.variant}
          disabled={working}
          className="h-11 font-semibold md:h-9"
          onClick={onConfirm}
        >
          {t(working ? "share.saving" : chosen.confirm)}
        </Button>
      </div>
    </div>
  );
}
