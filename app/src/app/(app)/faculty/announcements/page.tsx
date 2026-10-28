import { AnnouncementComposer } from "@/components/faculty/announcement-composer";
import { QuestionQueue } from "@/components/faculty/question-queue";
import { requireAuth } from "@/lib/auth/guards";
import {
  listAuthoredAnnouncements,
  listOpenQuestions,
  listSupervisedClasses,
} from "@/lib/db/queries/faculty";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Announcements",
  description: "Post to a class, schedule ahead, and answer the questions waiting on you.",
  index: false,
  path: "/faculty/announcements",
});

/**
 * `/faculty/announcements`.
 *
 * The plainest screen in the phase and the one most likely to decide whether a
 * faculty member comes back on a Tuesday: it is the thing they already do over
 * email, done once instead of thirty times.
 *
 * The open questions sit on the same page rather than behind their own tab,
 * because they are the same job — a faculty member sitting down to communicate
 * with a class should not have to remember a second place to look. The answer
 * posts into the group's own thread, where the next person with the same
 * question will find it.
 */
export default async function AnnouncementsPage() {
  const viewer = await requireAuth("/faculty/announcements");

  const now = new Date();

  const [classes, announcements, questions] = await Promise.all([
    listSupervisedClasses(viewer),
    listAuthoredAnnouncements(viewer),
    listOpenQuestions(viewer),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <AnnouncementComposer
        now={now}
        classes={classes.map((klass) => ({
          id: klass.id,
          label: `${klass.subject.code} ${klass.subject.name}${klass.section ? ` · ${klass.section}` : ""}`,
          groupCount: klass._count.groups,
        }))}
        announcements={announcements.map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          body: announcement.body,
          publishAt: announcement.publishAt,
          classLabel: announcement.class
            ? `${announcement.class.subject.code}${announcement.class.section ? ` · ${announcement.class.section}` : ""}`
            : "Whole college",
        }))}
      />

      <QuestionQueue
        now={now}
        questions={questions.map((thread) => ({
          id: thread.id,
          title: thread.title,
          body: thread.body,
          createdAt: thread.createdAt,
          groupId: thread.groupId,
          groupName: thread.group.name,
          authorName: thread.author.name,
          authorAvatarUrl: thread.author.avatarUrl,
          replyCount: thread._count.messages,
        }))}
      />
    </div>
  );
}
