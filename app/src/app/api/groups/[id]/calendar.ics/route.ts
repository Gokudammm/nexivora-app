import { currentViewer } from "@/lib/auth/session";
import { requireWorkspace } from "@/lib/db/queries/group";
import { listMeetings } from "@/lib/db/queries/workspace";

/**
 * The group's calendar, as `.ics`.
 *
 * Authorised through `requireWorkspace()` like every other workspace read, and
 * 404s identically when the group is not the viewer's — a calendar export is a
 * read of the workspace, and giving it a different refusal would make it the
 * one URL that confirms a group exists.
 *
 * Hand-written rather than pulled from a library. RFC 5545 is fussy in exactly
 * three ways that matter here — CRLF line endings, escaping in TEXT values, and
 * folding at 75 octets — and all three are twenty lines. A dependency for that
 * would be more surface than substance.
 */

const CRLF = "\r\n";

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newline are escaped. */
const escape = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** §3.1: lines fold at 75 octets, continuations begin with one space. */
function fold(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;

  const parts: string[] = [];
  let current = "";

  for (const character of line) {
    if (Buffer.byteLength(current + character, "utf8") > 74) {
      parts.push(current);
      current = " ";
    }
    current += character;
  }
  parts.push(current);

  return parts.join(CRLF);
}

const stamp = (date: Date): string => `${date.toISOString().replace(/[-:]|\.\d{3}/g, "")}`;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const viewer = await currentViewer();
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) return new Response("Not found", { status: 404 });

  const { upcoming, past } = await listMeetings(workspace);
  const meetings = [...past, ...upcoming];
  const now = new Date();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexivora//Workspace//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(workspace.name)}`,
  ];

  for (const meeting of meetings) {
    const end = new Date(meeting.startsAt.getTime() + meeting.durationMinutes * 60_000);

    const description = [
      meeting.agenda,
      // The join link goes in the description as well as URL: most calendar
      // clients show one or the other, and nobody wants to discover which at
      // two minutes to the meeting.
      meeting.joinUrl ? `Join: ${meeting.joinUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${meeting.id}@nexivora`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(meeting.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(meeting.title)}`,
      ...(description ? [`DESCRIPTION:${escape(description)}`] : []),
      ...(meeting.location ? [`LOCATION:${escape(meeting.location)}`] : []),
      ...(meeting.joinUrl ? [`URL:${escape(meeting.joinUrl)}`] : []),
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.map(fold).join(CRLF) + CRLF, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${workspace.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
