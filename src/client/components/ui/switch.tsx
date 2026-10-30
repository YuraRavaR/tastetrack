import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

// 52×32 on a phone and 44×26 from `md`. Below `md` a transparent strip above and below the track
// brings the tap target to 44px.
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex h-8 w-13 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input md:h-6.5 md:w-11 md:after:hidden",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-6.5 rounded-full bg-card shadow-sm transition-transform data-[state=checked]:translate-x-5.5 data-[state=unchecked]:translate-x-0.5 md:size-5 md:data-[state=checked]:translate-x-5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
