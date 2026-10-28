"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { answerQuestion } from "@/lib/evaluation/announcements";

/**
 * Questions waiting on a faculty answer.
 *
 * Oldest first, and the age is shown rather than the date — a question asked
 * nine days ago reads as a problem in a way "2 September" does not.
 *
 * The answer posts into the **group's own thread**, not a private faculty
 * reply. The next person with the same question should find the answer where
 * they are already looking, and a group mate who was too shy to ask should not
 * have to. That is also why resolving is a separate checkbox: an answer is not
 * automatically the end of the conversation, and closing a thread the asker
 * still has a follow-up on is how people learn not to ask.
 */

type Question = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  groupId: string;
  groupName: string;
  authorName: string;
  authorAvatarUrl: string | null;
  replyCount: number;
};

/** Age, not date: "9d ago" reads as a problem in a way "2 September" does not. */
const ago = (date: Date, now: Date): string => {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export function QuestionQueue({ questions, now }: { questions: Question[]; now: Date }) {
  return (
    <aside className="grid content-start gap-4">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 font-medium">
          Questions waiting
          {questions.length > 0 ? (
            <Badge tone={questions.length > 4 ? "warning" : "neutral"}>{questions.length}</Badge>
          ) : null}
        </h2>
        <p className="text-xs text-fg-muted">
          Oldest first. Answers post into the group&rsquo;s thread, where the next person to ask
          will find them.
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-fg-subtle">Nothing open. Everything asked has been answered.</p>
      ) : (
        <ul className="grid gap-3">
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} now={now} />
          ))}
        </ul>
      )}
    </aside>
  );
}

function QuestionCard({ question, now }: { question: Question; now: Date }) {
  const [open, setOpen] = useState(false);
  const age = now.getTime() - question.createdAt.getTime();
  const stale = age > 3 * 86_400_000;

  return (
    <li
      className={
        stale
          ? "grid gap-2 rounded-xl border border-warning/40 bg-warning-bg/20 p-4"
          : "grid gap-2 rounded-xl border border-border p-4"
      }
    >
      <div className="flex items-center gap-2">
        <Avatar
          name={question.authorName}
          src={question.authorAvatarUrl}
          seed={question.authorName}
          size="xs"
        />
        <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
          {question.authorName} ·{" "}
          <Link href={`/groups/${question.groupId}`} className="hover:text-primary">
            {question.groupName}
          </Link>
        </span>
        <span
          className={stale ? "shrink-0 text-xs text-warning" : "shrink-0 text-xs text-fg-subtle"}
        >
          {ago(question.createdAt, now)}
        </span>
      </div>

      <Link
        href={`/groups/${question.groupId}/discussion/${question.id}`}
        className="hover:text-primary text-sm font-medium"
      >
        {question.title}
      </Link>

      <p className="line-clamp-3 text-xs text-fg-muted">{question.body}</p>

      {question.replyCount > 0 ? (
        <p className="text-xs text-fg-subtle">
          {question.replyCount} {question.replyCount === 1 ? "reply" : "replies"} already
        </p>
      ) : null}

      {open ? (
        <AnswerForm threadId={question.id} onCancel={() => setOpen(false)} />
      ) : (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Answer
          </Button>
        </div>
      )}
    </li>
  );
}

function AnswerForm({ threadId, onCancel }: { threadId: string; onCancel: () => void }) {
  const [state, formAction] = useActionState(answerQuestion, null);

  if (state?.ok) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="grid gap-2 border-t border-border pt-3">
      <input type="hidden" name="threadId" value={threadId} />

      <Field
        label="Your answer"
        labelHidden
        required
        error={state && !state.ok ? state.error : undefined}
      >
        <Textarea
          name="body"
          rows={4}
          required
          maxLength={8000}
          placeholder="Answer here. It posts into the group's thread."
          className="text-sm"
        />
      </Field>

      <label className="flex items-center gap-2 text-xs text-fg-muted">
        <input type="checkbox" name="resolve" value="true" className="accent-primary-600" />
        Mark the question resolved
      </label>

      <div className="flex gap-2">
        <Submit />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" loading={pending} disabled={pending}>
      Post answer
    </Button>
  );
}
