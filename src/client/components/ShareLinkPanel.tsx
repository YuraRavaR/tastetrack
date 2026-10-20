import { Check, Copy, Link2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ShareLink } from "../../shared/api";
import * as api from "../api";
import { type MessageId, t } from "../i18n/t";

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

// Sharing one of the User's Lists, the Watchlist included: a button that makes a Share Link, and
// once there is one, the link to copy and buttons to replace it or stop sharing, each asked about
// first since anyone holding the old link loses it. After each change `onChanged` reloads the
// List, so the link shown is always the Worker's.
export function ShareLinkPanel({
  listId,
  shareLink,
  onChanged,
}: {
  listId: number;
  shareLink: ShareLink | null;
  onChanged: () => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  // The dialog keeps its action while it closes, so its text doesn't change as it fades out.
  const [action, setAction] = useState<Action>("revoke");
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const chosen = actions[action];

  async function change(action: () => Promise<unknown>) {
    setWorking(true);
    setFailed(false);
    const done = await action();
    setWorking(false);
    if (!done) return setFailed(true);
    setConfirming(false);
    setCopied(false);
    await onChanged();
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

  const failure = failed && (
    <p role="alert" className="text-destructive text-sm">
      {t("share.failed")}
    </p>
  );

  if (!shareLink) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={working}
          onClick={() => change(() => api.createShareLink(listId))}
        >
          <Link2 aria-hidden />
          {t(working ? "share.sharing" : "share.share")}
        </Button>
        {failure}
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-3"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${inputId}-title`} className="font-medium">
          {t("share.title")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("share.explanation")}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          {t("share.linkLabel")}
        </label>
        <Input
          ref={input}
          id={inputId}
          readOnly
          value={shareLink.url}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button className="shrink-0" onClick={() => copy(shareLink.url)}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {t(copied ? "share.copied" : "share.copy")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(actions) as Action[]).map((each) => (
          <Button
            key={each}
            variant="outline"
            size="sm"
            onClick={() => {
              setAction(each);
              setConfirming(true);
            }}
          >
            {t(actions[each].button)}
          </Button>
        ))}
      </div>
      {!confirming && failure}
      <AlertDialog
        open={confirming}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setFailed(false);
          setConfirming(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(chosen.title)}</AlertDialogTitle>
            <AlertDialogDescription>{t(chosen.description)}</AlertDialogDescription>
          </AlertDialogHeader>
          {failure}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("share.cancel")}</AlertDialogCancel>
            <Button
              variant={chosen.variant}
              disabled={working}
              onClick={() => change(() => chosen.run(listId))}
            >
              {t(working ? "share.saving" : chosen.confirm)}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
