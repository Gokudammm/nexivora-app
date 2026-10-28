/**
 * @MENTIONS.
 *
 * One rule, and it is a privacy rule rather than a parsing one: **a mention is
 * resolved against the members of the group, never against the college
 * directory.** Anything else lets somebody type `@principal` into a private
 * workspace thread and pull a person into a room they were never given access
 * to — and, worse, tells the author whether that username exists.
 *
 * Kept as a plain module rather than a Server Action file so the parser can be
 * unit-tested and imported from both the task and discussion paths without
 * either owning it.
 */

export type MentionableMember = {
  user: { id: string; name: string; username: string | null };
};

/** `@username`, bounded so an email address does not read as a mention. */
const MENTION = /(^|[^\w@/])@([a-z0-9][a-z0-9-]{1,30})\b/gi;

/** The usernames a body mentions, whether or not they exist. */
export function parseMentions(body: string): string[] {
  return [...body.matchAll(MENTION)].map((match) => match[2]!.toLowerCase());
}

/**
 * Resolve mentions to member ids.
 *
 * Unmatched handles are simply dropped. There is deliberately no "that user
 * does not exist" feedback: it would answer, one guess at a time, which
 * usernames are in this group.
 */
export function extractMentions(
  body: string,
  members: readonly MentionableMember[],
): { userId: string; username: string }[] {
  const handles = new Set(parseMentions(body));
  if (handles.size === 0) return [];

  return members
    .filter((member) => member.user.username && handles.has(member.user.username.toLowerCase()))
    .map((member) => ({ userId: member.user.id, username: member.user.username! }));
}
