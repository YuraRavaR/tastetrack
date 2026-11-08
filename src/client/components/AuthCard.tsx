import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// The plain centred card that log in, register and set a new password share
// (`docs/mockups/sign-in/`): a heading, an optional line under it, and the form.
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="mx-auto w-full max-w-sm gap-4 rounded-xl px-5 py-6 shadow-none md:mt-12 md:px-7 md:pt-7 md:shadow-sm">
      <div className="mb-1 flex flex-col gap-2">
        <h1 className="font-bold text-2xl tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

// A labelled 44px field, with its rules under it when it has any. `invalid` marks the field, for an
// error about it; `rulesBroken` also turns its rules into an error, for what is typed now.
export function AuthField({
  id,
  label,
  rules,
  invalid = false,
  rulesBroken = false,
  className,
  ...inputProps
}: Omit<ComponentProps<typeof Input>, "id" | "aria-invalid" | "aria-describedby"> & {
  id: string;
  label: string;
  rules?: string;
  invalid?: boolean;
  rulesBroken?: boolean;
}) {
  const rulesId = `${id}-rules`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        className={cn("h-11", className)}
        aria-invalid={invalid || rulesBroken}
        aria-describedby={rules ? rulesId : undefined}
        {...inputProps}
      />
      {rules && (
        <p
          id={rulesId}
          className={cn(
            "text-[13px] leading-snug",
            rulesBroken ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {rules}
        </p>
      )}
    </div>
  );
}

// The line under the button that leads to the other form: "Have an Invite Code? Register".
export function SwitchFormLink({ prompt, to, link }: { prompt: string; to: string; link: string }) {
  return (
    <p className="mt-1 text-center text-muted-foreground text-sm">
      {prompt}{" "}
      <Link
        to={to}
        className="font-semibold text-primary-strong underline-offset-4 hover:underline"
      >
        {link}
      </Link>
    </p>
  );
}
