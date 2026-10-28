"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { changeRole, setSuspension } from "@/lib/admin/actions";
import { ROLE_LABEL } from "@/config/roles";

/**
 * Per-member controls.
 *
 * Suspension asks for a reason before it will proceed. That is not friction for
 * its own sake: the reason is written to the audit log, and a suspension nobody
 * can explain later is exactly the one that gets disputed.
 */
export function MemberControls({
  collegeId,
  membershipId,
  role,
  suspended,
}: {
  collegeId: string;
  membershipId: string;
  role: string;
  suspended: boolean;
}) {
  const [roleState, roleAction] = useActionState(changeRole, null);
  const [suspendState, suspendAction] = useActionState(setSuspension, null);
  const [asking, setAsking] = useState(false);

  return (
    <div className="grid gap-2">
      {roleState && !roleState.ok ? <Alert tone="danger">{roleState.error}</Alert> : null}
      {suspendState && !suspendState.ok ? <Alert tone="danger">{suspendState.error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="collegeId" value={collegeId} />
          <input type="hidden" name="membershipId" value={membershipId} />
          <select
            name="role"
            defaultValue={role}
            className="bg-bg h-8 rounded-md border border-border px-2 text-xs"
            aria-label="Role"
          >
            {Object.entries(ROLE_LABEL)
              .filter(([value]) => value !== "PLATFORM_ADMIN")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
          <Button type="submit" variant="ghost" size="sm">
            Set role
          </Button>
        </form>

        {suspended ? (
          <form action={suspendAction}>
            <input type="hidden" name="collegeId" value={collegeId} />
            <input type="hidden" name="membershipId" value={membershipId} />
            <input type="hidden" name="suspend" value="false" />
            <Button type="submit" variant="secondary" size="sm">
              Reinstate
            </Button>
          </form>
        ) : asking ? (
          <form action={suspendAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="collegeId" value={collegeId} />
            <input type="hidden" name="membershipId" value={membershipId} />
            <input type="hidden" name="suspend" value="true" />
            <input
              name="reason"
              required
              minLength={8}
              placeholder="Why? This is recorded."
              className="bg-bg h-8 w-56 rounded-md border border-border px-2 text-xs"
              aria-label="Reason for suspension"
            />
            <Button type="submit" variant="danger" size="sm">
              Suspend
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(true)}>
            Suspend
          </Button>
        )}
      </div>
    </div>
  );
}
