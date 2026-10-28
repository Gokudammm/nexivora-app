import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { ProposalPanel } from "@/components/project/proposal-panel";
import { SECTION_BY_KIND } from "@/config/sections";
import { requireAuth } from "@/lib/auth/guards";
import { capabilities, requireEditableProject } from "@/lib/db/queries/project-edit";
import { LABEL } from "@/lib/project/lifecycle";
import type { SimilarityMatch } from "@/lib/project/transitions";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Proposal",
  description:
    "The problem statement and proposed solution, checked against the archive before it goes to faculty.",
  index: false,
  path: "/projects",
});

/**
 * `/projects/[slug]/propose`.
 *
 * The similarity check runs **here**, before submission, and that placement is
 * the decision. Running it after approval means faculty discover a possible
 * duplicate once the group has already been told they are in — the worst
 * possible moment for everybody.
 *
 * The page is written to make a high score unalarming, because a high score is
 * frequently correct: a project that formally builds on a previous one *should*
 * look similar, and a replication study scores like a copy. It informs the
 * approval conversation; it never makes the decision.
 */
export default async function ProposePage({ params }: PageProps<"/projects/[slug]/propose">) {
  const { slug } = await params;
  const viewer = await requireAuth(`/projects/${slug}/propose`);
  const project = await requireEditableProject(viewer, slug);

  if (!project) notFound();

  const caps = capabilities(viewer, project);
  const check = project.similarityChecks[0] ?? null;
  const matches = (check?.matches ?? []) as SimilarityMatch[];

  const problem = project.sections.find((section) => section.kind === "PROBLEM");
  const solution = project.sections.find((section) => section.kind === "SOLUTION");

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="grid content-start gap-6 lg:col-span-2">
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium">{SECTION_BY_KIND.PROBLEM.label}</h2>
            {problem?.complete ? <Badge tone="success">complete</Badge> : null}
          </div>

          {problem?.body ? (
            <p className="text-sm whitespace-pre-wrap text-fg-muted">{problem.body}</p>
          ) : (
            <Alert tone="warning" title="Nothing written yet">
              The proposal is the problem statement. Write it first — the similarity check compares
              problems, not titles.{" "}
              <Link
                href={`/projects/${project.slug}/edit/problem`}
                className="font-medium underline underline-offset-4"
              >
                Write it now
              </Link>
              .
            </Alert>
          )}
        </section>

        <section className="grid gap-3">
          <h2 className="font-medium">{SECTION_BY_KIND.SOLUTION.label}</h2>
          {solution?.body ? (
            <p className="text-sm whitespace-pre-wrap text-fg-muted">{solution.body}</p>
          ) : (
            <p className="text-sm text-fg-subtle">
              Not written yet. A proposal does not require it, but it makes the approval
              conversation shorter.{" "}
              <Link
                href={`/projects/${project.slug}/edit/solution`}
                className="underline underline-offset-4 hover:text-fg"
              >
                Add it
              </Link>
              .
            </p>
          )}
        </section>

        <ProposalPanel
          slug={project.slug}
          status={project.status}
          canEdit={caps.edit}
          canFaculty={caps.faculty}
          hasProblem={(problem?.body.trim().length ?? 0) >= 40}
          check={
            check
              ? {
                  id: check.id,
                  topScore: check.topScore,
                  matches,
                  overrideReason: check.overrideReason,
                  overriddenBy: check.overriddenBy?.name ?? null,
                  createdAt: check.createdAt,
                }
              : null
          }
        />
      </div>

      <aside className="grid content-start gap-6">
        <section className="grid gap-2 rounded-xl border border-border p-5">
          <h2 className="font-medium">Where this is</h2>
          <p className="text-sm text-fg-muted">{LABEL[project.status]}</p>

          {project.status === "REJECTED" ? (
            <Alert tone="warning" title="Returned by your faculty guide">
              Read their reason on the sections page, revise, and propose again. Nothing is lost.
            </Alert>
          ) : null}

          {project.status === "APPROVED" || project.status === "IN_PROGRESS" ? (
            <p className="text-xs text-fg-subtle">
              Approved — the full record is unlocked. The proposal stays here as part of the
              history.
            </p>
          ) : null}
        </section>

        <section className="grid gap-2 rounded-xl border border-border p-5 text-sm text-fg-muted">
          <h2 className="font-medium text-fg">Why similarity is checked</h2>
          <p>
            So the same project is not built three times without anybody noticing, and so a group
            that <em>is</em> continuing previous work can say so and get credit for the lineage.
          </p>
          <p>
            A high score is not a problem in itself. It is a prompt for one conversation with your
            faculty guide.
          </p>
          {project.group ? (
            <Button asChild variant="ghost" size="sm" className="justify-self-start">
              <Link href={`/groups/${project.group.id}`}>Open the workspace</Link>
            </Button>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
