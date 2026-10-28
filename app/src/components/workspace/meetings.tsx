"use client";

import { useState } from "react";

import { CalendarIcon, ExternalIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import {
  markAttendance,
  rsvp,
  saveMinutes,
  scheduleMeeting,
  selfReportAttendance,
} from "@/lib/workspace/meetings";

import { ActionButton, ActionForm } from "./action-form";

/**
 * MEETINGS.
 *
 * The banner at the top is not boilerplate — it is the product decision, said
 * out loud. We store a link to whatever the group already uses. Anything else
 * would be a video product built badly beside a collaboration product built
 * properly, and the honest sentence costs nothing.
 *
 * The part that earns its place is **minutes → tasks**. Action items agreed in
 * a meeting are the single most-forgotten thing in student project work, and
 * one click puts them on the board in the same transaction that saves the
 * minutes.
 */

type Attendance = {
  rsvp: boolean | null;
  attended: boolean | null;
  user: { id: string; name: string; username: string | null; avatarUrl: string | null };
};

type Meeting = {
  id: string;
  title: string;
  agenda: string | null;
  notes: string | null;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  joinUrl: string | null;
  host: { id: string; name: string; avatarUrl: string | null };
  attendance: Attendance[];
};

const when = (date: Date) =>
  date.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export function Meetings({
  groupId,
  upcoming,
  past,
  viewerId,
  canSchedule,
  handles,
}: {
  groupId: string;
  upcoming: Meeting[];
  past: Meeting[];
  viewerId: string;
  canSchedule: boolean;
  handles: string[];
}) {
  const [composing, setComposing] = useState(false);
  const [minutesFor, setMinutesFor] = useState<Meeting | null>(null);

  return (
    <div className="grid gap-6">
      <Alert tone="info" title="We do not host video">
        Nexivora keeps the agenda, the attendance and the minutes. The call itself happens wherever
        your group already meets — paste a Meet, Zoom or Teams link and we will put it on the card.
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Upcoming</h2>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <a href={`/api/groups/${groupId}/calendar.ics`} download>
              <CalendarIcon />
              Export .ics
            </a>
          </Button>
          {canSchedule ? (
            <Button size="sm" onClick={() => setComposing(true)}>
              <PlusIcon />
              Schedule
            </Button>
          ) : null}
        </div>
      </div>

      {upcoming.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          description="Put the next check-in in the calendar. Everybody in the group is invited automatically."
          action={
            canSchedule ? <Button onClick={() => setComposing(true)}>Schedule one</Button> : null
          }
        />
      ) : (
        <ul className="grid gap-3">
          {upcoming.map((meeting) => (
            <li key={meeting.id}>
              <MeetingCard
                groupId={groupId}
                meeting={meeting}
                viewerId={viewerId}
                canSchedule={canSchedule}
                upcoming
                onMinutes={() => setMinutesFor(meeting)}
              />
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-medium">Past</h2>
          <ul className="grid gap-3">
            {past.map((meeting) => (
              <li key={meeting.id}>
                <MeetingCard
                  groupId={groupId}
                  meeting={meeting}
                  viewerId={viewerId}
                  canSchedule={canSchedule}
                  upcoming={false}
                  onMinutes={() => setMinutesFor(meeting)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {composing ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setComposing(false))}>
          <DialogContent
            title="Schedule a meeting"
            description="Everybody in the group is invited. A join link is optional."
          >
            <ActionForm
              action={scheduleMeeting}
              hidden={{ groupId }}
              submitLabel="Schedule"
              quiet
              onDone={() => setComposing(false)}
            >
              <Field label="Title" required>
                <Input name="title" required maxLength={160} placeholder="Weekly check-in" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts" required>
                  <Input name="startsAt" type="datetime-local" required />
                </Field>
                <Field label="Minutes">
                  <Input name="durationMinutes" type="number" min={5} max={480} defaultValue={30} />
                </Field>
              </div>

              <Field label="Agenda" hint="What needs deciding. Markdown works.">
                <Textarea name="agenda" rows={3} maxLength={4000} />
              </Field>

              <Field label="Where" hint="A room, a lab, or leave it blank.">
                <Input name="location" maxLength={160} placeholder="Lab 204" />
              </Field>

              <Field
                label="Join link"
                hint="Must start with https://. We store it; we do not host it."
              >
                <Input
                  name="joinUrl"
                  type="url"
                  maxLength={500}
                  placeholder="https://meet.google.com/…"
                />
              </Field>
            </ActionForm>
          </DialogContent>
        </Dialog>
      ) : null}

      {minutesFor ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setMinutesFor(null))}>
          <DialogContent
            title={`Minutes — ${minutesFor.title}`}
            description="Action items become tasks on the board, in the same save."
          >
            <ActionForm
              action={saveMinutes}
              hidden={{ groupId, meetingId: minutesFor.id }}
              submitLabel="Save minutes"
              quiet
              onDone={() => setMinutesFor(null)}
            >
              <Field label="Notes" hint="What was discussed and decided.">
                <Textarea
                  name="notes"
                  rows={6}
                  maxLength={8000}
                  defaultValue={minutesFor.notes ?? ""}
                />
              </Field>

              <Field
                label="Action items"
                hint={
                  handles.length > 0
                    ? `One per line. Add @${handles[0]} to assign it. Each becomes a task in To do.`
                    : "One per line. Each becomes a task in To do."
                }
              >
                <Textarea
                  name="actionItems"
                  rows={4}
                  maxLength={4000}
                  placeholder={`Order the replacement sensor @${handles[0] ?? "username"}\nDraft the results section`}
                />
              </Field>
            </ActionForm>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function MeetingCard({
  groupId,
  meeting,
  viewerId,
  canSchedule,
  upcoming,
  onMinutes,
}: {
  groupId: string;
  meeting: Meeting;
  viewerId: string;
  canSchedule: boolean;
  upcoming: boolean;
  onMinutes: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const mine = meeting.attendance.find((row) => row.user.id === viewerId);
  const going = meeting.attendance.filter((row) => row.rsvp === true);
  const attended = meeting.attendance.filter((row) => row.attended === true);

  return (
    <div className="grid gap-3 rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="flex flex-wrap items-center gap-2 font-medium">
            {meeting.title}
            {meeting.notes ? <Badge tone="success">minuted</Badge> : null}
          </h3>
          <p className="text-sm text-fg-muted">
            <time dateTime={meeting.startsAt.toISOString()}>{when(meeting.startsAt)}</time> ·{" "}
            {meeting.durationMinutes} min
            {meeting.location ? ` · ${meeting.location}` : ""} · hosted by {meeting.host.name}
          </p>
        </div>

        {meeting.joinUrl ? (
          <Button asChild variant="secondary" size="sm">
            <a href={meeting.joinUrl} target="_blank" rel="noopener noreferrer">
              Join
              <ExternalIcon />
            </a>
          </Button>
        ) : null}
      </div>

      {meeting.agenda ? <p className="text-sm text-fg-muted">{meeting.agenda}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(upcoming ? going : attended).slice(0, 6).map((row) => (
            <Avatar
              key={row.user.id}
              name={row.user.name}
              src={row.user.avatarUrl}
              seed={row.user.id}
              size="xs"
            />
          ))}
          <span className="text-xs text-fg-subtle">
            {upcoming
              ? `${going.length} going`
              : attended.length > 0
                ? `${attended.length} attended`
                : "attendance not recorded"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {upcoming ? (
            <>
              <ActionButton
                action={rsvp}
                hidden={{ groupId, meetingId: meeting.id, going: "yes" }}
                label={mine?.rsvp === true ? "Going ✓" : "Going"}
                variant={mine?.rsvp === true ? "primary" : "ghost"}
                size="sm"
              />
              <ActionButton
                action={rsvp}
                hidden={{ groupId, meetingId: meeting.id, going: "no" }}
                label="Can't"
                variant="ghost"
                size="sm"
              />
            </>
          ) : (
            <>
              {mine?.attended !== true ? (
                <ActionButton
                  action={selfReportAttendance}
                  hidden={{ groupId, meetingId: meeting.id }}
                  label="I was there"
                  variant="ghost"
                  size="sm"
                />
              ) : null}

              {canSchedule ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setRecording((open) => !open)}>
                    Record attendance
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onMinutes}>
                    {meeting.notes ? "Edit minutes" : "Add minutes"}
                  </Button>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {recording ? (
        <ActionForm
          action={markAttendance}
          hidden={{ groupId, meetingId: meeting.id }}
          submitLabel="Save attendance"
          quiet
          onDone={() => setRecording(false)}
          className="grid gap-3 rounded-lg border border-border p-4"
        >
          <p className="text-xs text-fg-muted">
            Attendance is the one ledger entry a person asserts rather than the system deriving it,
            so it carries a small weight and the record shows who marked it.
          </p>

          {/*
            Native checkboxes rather than the Checkbox primitive, deliberately.
            This form needs several inputs to share one name so FormData carries
            every id under "attended"; the Radix control renders a button plus a
            single hidden input and cannot express a repeated field.
          */}
          {meeting.attendance.map((row) => (
            <label key={row.user.id} className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="attended"
                value={row.user.id}
                defaultChecked={row.attended === true}
                className="size-4 rounded border-border-strong"
              />
              {row.user.name}
            </label>
          ))}
        </ActionForm>
      ) : null}

      {meeting.notes ? (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Minutes</summary>
          <p className="mt-2 text-sm whitespace-pre-wrap text-fg-muted">{meeting.notes}</p>
        </details>
      ) : null}
    </div>
  );
}
