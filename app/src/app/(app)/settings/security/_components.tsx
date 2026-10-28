"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changePassword, revokeSession } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/policy-password";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);

  return (
    <form action={action} className="grid gap-5" noValidate>
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <Field label="Current password">
        <Input name="current" type="password" autoComplete="current-password" required />
      </Field>

      <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
        />
      </Field>

      <Field label="Confirm new password">
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}

export type SessionRow = {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  expires: Date;
  current: boolean;
};

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const [state, action] = useActionState(revokeSession, null);

  return (
    <div className="grid gap-4">
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <ul className="grid gap-2">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
          >
            <div className="grid gap-0.5">
              <p className="text-sm font-medium">
                {describeDevice(session.userAgent)}
                {session.current ? (
                  <span className="bg-bg-subtle ml-2 rounded-full px-2 py-0.5 text-xs font-normal text-fg-muted">
                    This device
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-fg-muted">
                Signed in{" "}
                {session.createdAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>

            {session.current ? null : (
              <form action={action}>
                <input type="hidden" name="sessionId" value={session.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Sign out
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A readable device name from a user-agent string.
 *
 * Deliberately coarse. The purpose is "do I recognise this?", and a full
 * user-agent string answers that worse than "Chrome on Windows" does — it is
 * also the kind of detail that makes a security page feel like a log file
 * rather than a control.
 */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : /Firefox\//.test(userAgent)
            ? "Firefox"
            : "Browser";

  const platform = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iOS/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";

  return platform ? `${browser} on ${platform}` : browser;
}
