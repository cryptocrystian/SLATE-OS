"use client";

import * as React from "react";
import { Copy, MailPlus, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/intake/helpers";
import {
  createStakeholderSession,
  type CreateSessionResult,
} from "@/lib/intake/actions";
import type { StakeholderRole } from "@/lib/intake/types";

const ROLE_OPTIONS: StakeholderRole[] = [
  "executive",
  "operations",
  "sales",
  "marketing",
  "finance",
  "it",
  "frontline",
  "customer-success",
  "other",
];

export interface CreateStakeholderFormProps {
  engagementId: string;
  trustWarning?: string;
}

export function CreateStakeholderForm({
  engagementId,
  trustWarning,
}: CreateStakeholderFormProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [role, setRole] = React.useState<StakeholderRole>("operations");
  const [department, setDepartment] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<{
    name: string;
    intakeUrl: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCopied(false);
    setPending(true);
    try {
      const result: CreateSessionResult = await createStakeholderSession({
        engagementId,
        name,
        email,
        title,
        role,
        department,
      });
      if (result.ok) {
        setSuccess({ name, intakeUrl: result.intakeUrl });
        setName("");
        setEmail("");
        setTitle("");
        setDepartment("");
        setRole("operations");
      } else {
        setError(translateError(result.error));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.intakeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Invite a stakeholder
          </span>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            Generate a token-gated intake link
          </h2>
          <p className="text-xs leading-relaxed text-text-muted">
            Enter the stakeholder&apos;s details, copy the generated link,
            and send it manually. Email automation lands later.
          </p>
        </div>

        {trustWarning ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-xs text-text-secondary"
          >
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-status-warning" />
            <span className="leading-relaxed">{trustWarning}</span>
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Casey Morgan"
            required
            autoComplete="off"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="casey@company.com"
            required
            autoComplete="off"
          />
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VP Operations"
            required
            autoComplete="off"
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="stakeholder-role"
              className="text-xs font-medium tracking-tight text-text-secondary"
            >
              Role
            </label>
            <select
              id="stakeholder-role"
              value={role}
              onChange={(e) => setRole(e.target.value as StakeholderRole)}
              className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Department (optional)"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Operations"
            autoComplete="off"
            className="sm:col-span-2"
          />

          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-text-muted">
              Tokens are unique, expire in 21 days, and only the hash is
              stored.
            </p>
            <Button
              type="submit"
              variant="primary"
              size="md"
              leadingIcon={<MailPlus className="h-4 w-4" />}
              disabled={pending}
            >
              {pending ? "Generating link…" : "Generate intake link"}
            </Button>
          </div>
        </form>

        {error ? (
          <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
            {error}
          </p>
        ) : null}

        {success ? (
          <div className="flex flex-col gap-3 rounded-md border border-status-success/40 bg-status-success/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-status-success">
                  Token link generated
                </span>
                <p className="text-sm text-text-primary">
                  Intake link ready for{" "}
                  <span className="font-semibold">{success.name}</span>.
                </p>
              </div>
              <Badge tone="success" variant="outline">
                One-time copy
              </Badge>
            </div>
            <code className="block break-all rounded-md border border-border-subtle bg-bg-page/70 p-3 font-mono text-[11px] text-text-secondary">
              {success.intakeUrl}
            </code>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-text-muted">
                Copy this intake link and send it manually. Email
                automation lands later.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leadingIcon={<Copy className="h-3.5 w-3.5" />}
                onClick={copyLink}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function translateError(code: CreateSessionFailure): string {
  switch (code) {
    case "missing-fields":
      return "Please fill out name, title, and a valid email address.";
    case "invalid-role":
      return "Pick a valid stakeholder role.";
    case "invalid-engagement":
    case "engagement-not-found":
      return "This engagement could not be found. Refresh the page and try again.";
    case "unauthenticated":
      return "Your session expired. Sign in again to create an intake link.";
    case "service-error":
    default:
      return "We couldn't create the intake session. Please try again.";
  }
}

type CreateSessionFailure = Exclude<CreateSessionResult, { ok: true }>["error"];
