import Link from "next/link";

import { Avatar, Badge } from "@/components/ui/display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ProposalDecision } from "@/components/project/proposal-decision";
import { requireAuth } from "@/lib/auth/guards";
import { listPendingProposals } from "@/lib/db/queries/project-edit";
import type { SimilarityMatch } from "@/lib/project/transitions";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Proposals",
  description: "Project proposals awaiting your approval, with the similarity check for each.",
  index: false,
  path: "/faculty/proposals",
});

/**
 * `/faculty/proposals`.
 *
 * Phase 8's one faculty route. Phase 9 owns the faculty dashboard proper and
 * should build around this rather than beside it — a second approval path would
 * mean two places deciding what "approved" means.
 *
 * Scoped to the subjects the viewer teaches, never to the college. A faculty
 * member approving proposals outside their subject is exactly the failure
 * ADR-029's per-subject scope exists to prevent.
 *
 * Ordered oldest-first: a proposal waiting three weeks is the one that matters,
 * and a newest-first queue buries it.
 */
export default async function ProposalsPage() {
  const viewer = await requireAuth("/faculty/proposals");
  const proposals = await listPendingProposals(viewer);

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Proposals</h1>
        <p className="text-sm text-fg-muted">
          {proposals.length === 0
            ? "Nothing waiting on you."
            : `${proposals.length} waiting, oldest first.`}
        </p>
      </header>

      {proposals.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="Proposals from groups in the subjects you teach appear here. You will see the problem statement and the archive similarity check together, before you decide."
          action={null}
        />
      ) : (
        <ul className="grid gap-4">
          {proposals.map((proposal) => {
            const check = proposal.similarityChecks[0];
            const matches = (check?.matches ?? []) as SimilarityMatch[];
            const flagged = matches.filter((match) => match.verdict === "duplicate");
            const waitingSince = proposal.statusEvents[0]?.createdAt ?? proposal.createdAt;

            return (
              <li key={proposal.id} className="grid gap-4 rounded-xl border border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <h2 className="flex flex-wrap items-center gap-2 font-medium">
                      <Link
                        href={`/projects/${proposal.slug}/propose`}
                        className="hover:text-primary underline underline-offset-4"
                      >
                        {proposal.title}
                      </Link>
                      {flagged.length > 0 ? (
                        <Badge tone="warning">{flagged.length} close match</Badge>
                      ) : check ? (
                        <Badge tone="success">checked</Badge>
                      ) : (
                        <Badge tone="neutral">not checked</Badge>
                      )}
                    </h2>

                    <p className="text-xs text-fg-muted">
                      {proposal.group?.name ?? "No group"} · waiting since{" "}
                      <time dateTime={waitingSince.toISOString()}>
                        {waitingSince.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                        })}
                      </time>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(proposal.group?.members ?? []).slice(0, 5).map((member) => (
                      <Avatar
                        key={member.user.id}
                        name={member.user.name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        size="xs"
                      />
                    ))}
                  </div>
                </div>

                <p className="text-sm text-fg-muted">{proposal.summary}</p>

                {proposal.sections[0]?.body ? (
                  <details className="rounded-lg border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Problem statement
                    </summary>
                    <p className="mt-2 text-sm whitespace-pre-wrap text-fg-muted">
                      {proposal.sections[0].body}
                    </p>
                  </details>
                ) : null}

                {flagged.length > 0 ? (
                  <Alert tone="info" title="Similar work in the archive">
                    <ul className="mt-1 grid gap-1">
                      {flagged.map((match) => (
                        <li key={match.slug} className="text-sm">
                          <Link
                            href={`/projects/${match.slug}`}
                            className="font-medium underline underline-offset-4"
                          >
                            {match.title}
                          </Link>{" "}
                          — {match.reason}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">
                      Overlap is often legitimate — a continuation or a replication should look like
                      this. If it is, clear it with a reason on the proposal page; the record keeps
                      your justification.
                    </p>
                  </Alert>
                ) : null}

                <ProposalDecision slug={proposal.slug} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
