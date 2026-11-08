import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

// A form's error, above its button, with the error icon. The field it is about is marked with
// `aria-invalid` by the form itself.
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-destructive text-sm">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
