import type { ReactNode } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";

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
