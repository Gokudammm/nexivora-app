"use client";

import { Avatar, Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  archiveGroup,
  inviteToGroup,
  leaveGroup,
  removeMember,
  transferLead,
  updateGroup,
} from "@/lib/workspace/actions";

import { ActionButton, ActionForm } from "./action-form";

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; username: string | null; avatarUrl: string | null };
};

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  sizeLimit: number;
  visibility: string;
  joinPolicy: string;
  archivedAt: Date | null;
  members: Member[];
};

/**
 * Settings, membership and the two irreversible-looking things.
 *
 * Neither is actually irreversible, which is the point: archiving is
 * restorable, and removing a member sets `leftAt` rather than deleting the row,
 * so their closed tasks and uploaded files stay attributed to them. There is no
 * delete button anywhere on this page — a group's workspace is the evidence
 * behind every contribution claim its members will ever make, and one bad week
 * should not be able to erase four years of somebody's record.
 */
export function GroupSettings({
  workspace,
  viewerId,
  isLead,
  canInvite,
}: {
  workspace: Workspace;
  viewerId: string;
  isLead: boolean;
  canInvite: boolean;
}) {
  const others = workspace.members.filter((member) => member.user.id !== viewerId);

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8">
      {!isLead ? (
        <Alert tone="info" title="You are not the lead of this group">
          You can see these settings and leave the group. Changing them is the lead&rsquo;s job.
        </Alert>
      ) : null}

      {/* ------------------------------------------------------ details */}

      <section className="grid gap-4">
        <h2 className="font-medium">Details</h2>

        {isLead ? (
          <ActionForm action={updateGroup} hidden={{ groupId: workspace.id }} submitLabel="Save">
            <Field label="Name" required>
              <Input name="name" required maxLength={80} defaultValue={workspace.name} />
            </Field>

            <Field label="Description">
              <Textarea
                name="description"
                rows={2}
                maxLength={500}
                defaultValue={workspace.description ?? ""}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Size limit" hint={`Currently ${workspace.members.length} members.`}>
                <Input
                  name="sizeLimit"
                  type="number"
                  min={2}
                  max={12}
                  defaultValue={workspace.sizeLimit}
                />
              </Field>

              <Field label="Who can see it exists">
                <Select name="visibility" defaultValue={workspace.visibility}>
                  <option value="GROUP">Members only</option>
                  <option value="CLASS">The class</option>
                  <option value="COLLEGE">The college</option>
                  <option value="PRIVATE">Nobody</option>
                </Select>
              </Field>
            </div>

            <Field label="How people join">
              <Select name="joinPolicy" defaultValue={workspace.joinPolicy}>
                <option value="REQUEST">Ask the lead</option>
                <option value="OPEN">Anyone in the class can join</option>
                <option value="INVITE_ONLY">Invitation only</option>
              </Select>
            </Field>
          </ActionForm>
        ) : (
          <dl className="grid gap-2 rounded-lg border border-border p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Name</dt>
              <dd>{workspace.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Places</dt>
              <dd>
                {workspace.members.length} of {workspace.sizeLimit}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Joining</dt>
              <dd>{workspace.joinPolicy.toLowerCase().replace("_", " ")}</dd>
            </div>
          </dl>
        )}
      </section>

      {/* ---------------------------------------------------- membership */}

      <section className="grid gap-4">
        <h2 className="font-medium">Members</h2>

        <ul className="grid divide-y divide-border rounded-xl border border-border">
          {workspace.members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar
                name={member.user.name}
                src={member.user.avatarUrl}
                seed={member.user.id}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {member.user.name}
                {member.user.id === viewerId ? (
                  <span className="text-fg-subtle"> (you)</span>
                ) : null}
              </span>

              {member.role === "LEAD" ? <Badge tone="outline">lead</Badge> : null}

              {isLead && member.user.id !== viewerId ? (
                <div className="flex gap-1.5">
                  <ActionButton
                    action={transferLead}
                    hidden={{ groupId: workspace.id, userId: member.user.id }}
                    label="Make lead"
                    variant="ghost"
                    size="sm"
                    confirm={`Hand leadership of this group to ${member.user.name}? You become an ordinary member.`}
                  />
                  <ActionButton
                    action={removeMember}
                    hidden={{ groupId: workspace.id, userId: member.user.id }}
                    label="Remove"
                    variant="ghost"
                    size="sm"
                    confirm={`Remove ${member.user.name}? Their tasks, files and ledger entries stay attributed to them.`}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {canInvite && workspace.members.length < workspace.sizeLimit ? (
          <ActionForm
            action={inviteToGroup}
            hidden={{ groupId: workspace.id }}
            submitLabel="Add to group"
          >
            <Field
              label="Add somebody"
              hint="Username or email. They must already be at this college — cross-college work needs a guest membership from an administrator."
            >
              <Input name="identifier" required maxLength={200} placeholder="ananya-sharma" />
            </Field>
          </ActionForm>
        ) : null}
      </section>

      {/* --------------------------------------------------------- exits */}

      <section className="grid gap-4 rounded-xl border border-border p-5">
        <h2 className="font-medium">Leaving and archiving</h2>
        <p className="text-sm text-fg-muted">
          Nothing here deletes anything. Archiving hides the group from the active list and keeps
          every task, file, thread and ledger entry exactly as it is — those are the evidence behind
          what each of you contributed.
        </p>

        <div className="flex flex-wrap gap-2">
          <ActionButton
            action={leaveGroup}
            hidden={{ groupId: workspace.id }}
            label="Leave group"
            variant="secondary"
            confirm={
              isLead && others.length > 0
                ? "You lead this group — transfer leadership first."
                : "Leave this group? Your past contributions stay on the record."
            }
          />

          {isLead ? (
            <ActionButton
              action={archiveGroup}
              hidden={{
                groupId: workspace.id,
                restore: workspace.archivedAt ? "true" : undefined,
              }}
              label={workspace.archivedAt ? "Restore group" : "Archive group"}
              variant="secondary"
              confirm={
                workspace.archivedAt
                  ? undefined
                  : "Archive this group? It stays fully readable and can be restored."
              }
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
