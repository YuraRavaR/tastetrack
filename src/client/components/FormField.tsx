import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// A labelled 44px field, with its rules under it when it has any, on the sign-in card and in
// Settings. `invalid` marks the field, for an error about it; `rulesBroken` also turns its rules
// into an error, for what is typed now.
export function FormField({
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
