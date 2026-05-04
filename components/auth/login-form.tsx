"use client";

import * as React from "react";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithMagicLink } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export interface LoginFormProps {
  defaultEmail?: string;
  invalid?: boolean;
}

export function LoginForm({ defaultEmail, invalid }: LoginFormProps) {
  const [pending, setPending] = React.useState(false);

  return (
    <form
      action={signInWithMagicLink}
      onSubmit={() => setPending(true)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Input
        type="email"
        name="email"
        label="Operator email"
        placeholder="you@saipienlabs.com"
        autoComplete="email"
        required
        defaultValue={defaultEmail}
        invalid={invalid}
        hint="We send a one-time sign-in link. Operator access only."
      />
      <Button
        type="submit"
        size="lg"
        className={cn("w-full justify-center")}
        disabled={pending}
        leadingIcon={
          pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Mail className="h-4 w-4" aria-hidden />
          )
        }
        trailingIcon={
          pending ? null : <ArrowRight className="h-4 w-4" aria-hidden />
        }
      >
        {pending ? "Sending magic link…" : "Send magic link"}
      </Button>
    </form>
  );
}
