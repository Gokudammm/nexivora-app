"use client";

import { AvatarGroup, Badge } from "@/components/ui/display";
import { joinGroup } from "@/lib/workspace/actions";

import { ActionButton } from "./action-form";

/**
 * Groups in your classes that you could join.
 *
 * Only groups that are actually joinable appear: college-visible, unarchived
 * and not full. A discovery list that shows a group you cannot join is a list
 * of dead ends, and the `REQUEST` case says so plainly rather than presenting a
 * button that fails.
 */

type Joinable = {
  id: string;
  name: string;
  description: string | null;
  joinPolicy: string;
  sizeLimit: number;
  memberCount: number;
  class: { subject: { name: string; code: string } } | null;
  members: { user: { id: string; name: string; avatarUrl: string | null } }[];
};

export function JoinableGroups({ groups }: { groups: Joinable[] }) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-sm font-medium text-fg-muted">Groups in your classes</h2>
        <p className="text-xs text-fg-subtle">
          Open groups you can join directly. The rest ask their lead to add you.
        </p>
      </div>

      <ul className="grid gap-3">
        {groups.map((group) => (
          <li
            key={group.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
          >
            <div className="grid min-w-0 gap-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {group.name}
                {group.class ? <Badge tone="outline">{group.class.subject.code}</Badge> : null}
              </p>
              <p className="text-xs text-fg-muted">
                {group.memberCount} of {group.sizeLimit} places filled
                {group.description ? ` · ${group.description}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <AvatarGroup
                max={4}
                people={group.members.map((member) => ({
                  name: member.user.name,
                  src: member.user.avatarUrl,
                  seed: member.user.id,
                }))}
              />

              {group.joinPolicy === "OPEN" ? (
                <ActionButton
                  action={joinGroup}
                  hidden={{ groupId: group.id }}
                  label="Join"
                  size="sm"
                />
              ) : (
                <span className="text-xs text-fg-subtle">Invite only</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
